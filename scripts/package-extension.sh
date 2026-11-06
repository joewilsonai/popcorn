#!/usr/bin/env bash
# Builds the zip you upload to the Chrome Web Store: dist/popcorn-extension-<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."
VER="$(python3 -c 'import json; print(json.load(open("extension/manifest.json"))["version"])')"
mkdir -p dist
OUT="dist/popcorn-extension-$VER.zip"
rm -f "$OUT"
(cd extension && zip -q -r "../$OUT" . -x "icons/icon.svg" -x ".*")
echo "$OUT"
unzip -l "$OUT" | tail -n +4 | sed '$d' | sed '$d'
