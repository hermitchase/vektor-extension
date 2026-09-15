import os
import sys
import zipfile


def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for root, _dirs, files in os.walk(src):
            for name in files:
                full = os.path.join(root, name)
                relative = os.path.relpath(full, src)
                archive.write(full, relative)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
