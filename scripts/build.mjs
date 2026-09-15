import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const target = process.argv[2] || "all";

function buildFirefox() {
  const out = join(dist, "firefox");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(join(root, "src"), join(out, "src"), { recursive: true });
  cpSync(join(root, "manifest.json"), join(out, "manifest.json"));
  console.log(`Firefox MV2 build -> ${out}`);
}

function buildChrome() {
  const out = join(dist, "chrome");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(join(root, "src"), join(out, "src"), { recursive: true });
  const manifest = readFileSync(join(root, "manifest.chrome.json"), "utf8");
  writeFileSync(join(out, "manifest.json"), manifest);
  console.log(`Chrome MV3 build -> ${out}`);
}

if (target === "firefox" || target === "all") buildFirefox();
if (target === "chrome" || target === "all") buildChrome();

if (!existsSync(dist)) {
  console.error("Nothing built.");
  process.exit(1);
}
