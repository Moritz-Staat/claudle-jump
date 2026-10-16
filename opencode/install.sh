#!/bin/sh
# Installs the Claudle Jump OpenCode plugin into the OpenCode config dir.
# Env: CLAUDLE_JUMP_VERSION (default 0.1.0), CLAUDLE_JUMP_ASSET (local tarball
# instead of a download), OPENCODE_CONFIG_DIR (default ~/.config/opencode).
set -eu

VERSION="${CLAUDLE_JUMP_VERSION:-0.1.0}"
CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
URL="https://github.com/Moritz-Staat/claudle-jump/releases/download/opencode-v${VERSION}/claudle-jump-opencode.tar.gz"

command -v node >/dev/null 2>&1 || { echo "node is required to edit cli.json" >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is required" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "${CLAUDLE_JUMP_ASSET:-}" ]; then
  echo "Using local asset $CLAUDLE_JUMP_ASSET"
  cp "$CLAUDLE_JUMP_ASSET" "$TMP/asset.tar.gz"
else
  echo "Downloading $URL"
  curl -fsSL -o "$TMP/asset.tar.gz" "$URL"
fi

mkdir -p "$TMP/x" "$CONFIG_DIR"
# Pipe through gzip: GNU tar reads "C:\..." paths as remote hosts.
(cd "$TMP/x" && gzip -dc ../asset.tar.gz | tar -xf -)
[ -f "$TMP/x/claudle-jump/tui.tsx" ] || { echo "Asset has no claudle-jump/tui.tsx" >&2; exit 1; }

rm -rf "$CONFIG_DIR/claudle-jump"
cp -R "$TMP/x/claudle-jump" "$CONFIG_DIR/claudle-jump"
echo "Installed plugin folder: $CONFIG_DIR/claudle-jump"

CJ_FILE="$CONFIG_DIR/cli.json" node -e '
const fs = require("fs");
const file = process.env.CJ_FILE;
const entry = "./claudle-jump";
let config = { $schema: "https://opencode.ai/v2/cli.json", plugins: [] };
if (fs.existsSync(file)) {
  config = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
if (!Array.isArray(config.plugins)) config.plugins = [];
if (config.plugins.includes(entry)) {
  console.log("cli.json already lists " + entry);
} else {
  config.plugins.push(entry);
  console.log("Added " + entry + " to plugins in " + file);
}
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
'

echo "Restart OpenCode, then type /jump"
