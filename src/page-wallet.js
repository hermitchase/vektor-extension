window.addEventListener("message", async (event) => {
  if (event.source !== window || event.data?.source !== "VEKTOR_CONTENT_WALLET_REQUEST") return;

  const requestId = event.data.requestId;
  const chain = event.data.chain;
  try {
    const provider = await getWalletProvider(event.data.preferredWallet || "");
    if (!provider?.request) throw new Error("No injected EVM wallet found on this page.");
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const switchResult = chain?.chainId ? await switchToChain(provider, chain) : { chainId: await provider.request({ method: "eth_chainId" }) };
    if (event.data.action === "SEND_TRANSACTION") {
      if (switchResult.error) throw new Error(switchResult.error);
      const activeChain = await provider.request({ method: "eth_chainId" }).catch(() => "");
      if (chain?.chainId && activeChain && activeChain.toLowerCase() !== chain.chainId.toLowerCase()) {
        throw new Error(`Wallet is on chain ${activeChain}, not Robinhood Chain (${chain.chainId}). Switch networks in the wallet before launching.`);
      }
      const transaction = { ...(event.data.transaction || {}) };
      delete transaction.chainId;
      const transactionHash = await provider.request({ method: "eth_sendTransaction", params: [transaction] });
      window.postMessage(
        {
          source: "VEKTOR_PAGE_WALLET_RESPONSE",
          requestId,
          address: accounts?.[0] || "",
          chainId: switchResult.chainId,
          transactionHash,
        },
        "*",
      );
      return;
    }

    window.postMessage(
      {
        source: "VEKTOR_PAGE_WALLET_RESPONSE",
        requestId,
        address: accounts?.[0] || "",
        chainId: switchResult.chainId,
        chainSwitchError: switchResult.error || "",
      },
      "*",
    );
  } catch (error) {
    window.postMessage(
      { source: "VEKTOR_PAGE_WALLET_RESPONSE", requestId, error: formatWalletError(error) },
      "*",
    );
  }
});

function formatWalletError(error) {
  const message = error?.message || "Wallet rejected the request.";
  const code = error?.code !== undefined ? ` code ${error.code}` : "";
  const dataMessage = error?.data?.message || error?.data?.originalError?.message || "";
  return [message, code, dataMessage].filter(Boolean).join(" | ");
}

async function getWalletProvider(preferredWallet) {
  const providers = Array.isArray(window.ethereum?.providers) ? window.ethereum.providers : [window.ethereum].filter(Boolean);
  if (preferredWallet) return providers.find((provider) => getWalletId(provider) === preferredWallet) || providers[0];
  if (providers.length <= 1) return providers[0];

  return pickWalletProvider(providers);
}

function pickWalletProvider(providers) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:2147483647;display:grid;place-items:center;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";

    const panel = document.createElement("div");
    panel.style.cssText = "width:min(360px,calc(100vw - 32px));background:#030712;border:1px solid rgba(16,185,129,.28);border-radius:20px;padding:16px;box-shadow:0 24px 80px rgba(0,0,0,.5);color:white;";

    const title = document.createElement("strong");
    title.textContent = "Choose wallet for VEKTOR";
    title.style.cssText = "display:block;font-size:16px;margin-bottom:10px;";
    panel.appendChild(title);

    providers.forEach((provider) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = getWalletName(provider);
      button.style.cssText = "display:block;width:100%;margin-top:8px;padding:12px;border:0;border-radius:14px;background:#10b981;color:#030712;font-weight:900;cursor:pointer;";
      button.addEventListener("click", () => {
        backdrop.remove();
        resolve(provider);
      });
      panel.appendChild(button);
    });

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
  });
}

function getWalletId(provider) {
  if (provider?.isMetaMask && !provider?.isPhantom) return "metamask";
  if (provider?.isPhantom) return "phantom";
  if (provider?.isCoinbaseWallet) return "coinbase";
  if (provider?.isRabby) return "rabby";
  return "wallet";
}

function getWalletName(provider) {
  if (provider?.isMetaMask && !provider?.isPhantom) return "MetaMask";
  if (provider?.isPhantom) return "Phantom";
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isRabby) return "Rabby";
  return "Browser wallet";
}

async function switchToChain(provider, chain) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.chainId }] });
  } catch (error) {
    if (error?.code !== 4902) return switchFallback(provider, error);
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chain.chainId,
            chainName: chain.name,
            rpcUrls: chain.rpcUrls,
            nativeCurrency: chain.nativeCurrency,
            blockExplorerUrls: chain.blockExplorerUrls,
          },
        ],
      });
    } catch (addError) {
      return switchFallback(provider, addError);
    }
  }

  return { chainId: await provider.request({ method: "eth_chainId" }) };
}

async function switchFallback(provider, error) {
  let chainId = "";
  try {
    chainId = await provider.request({ method: "eth_chainId" });
  } catch (_error) {
    chainId = "";
  }

  const walletName = getWalletName(provider);
  return {
    chainId,
    error: `${walletName} connected, but rejected Robinhood Chain switching: ${error?.message || "unsupported network"}. Switch to Robinhood Chain manually in the wallet and reconnect.`,
  };
}
