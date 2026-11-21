#!/usr/bin/env bash
# Copy the build into a vault's plugin folder. Default: the local test vault.
set -euo pipefail
cd "$(dirname "$0")/.."
VAULT="${1:-test-vault}"
DEST="$VAULT/.obsidian/plugins/inkwell"
[ -d "$VAULT/.obsidian" ] || { echo "Not a vault: $VAULT" >&2; exit 1; }
mkdir -p "$DEST"
cp main.js manifest.json styles.css "$DEST/"
echo "Deployed to $DEST"
