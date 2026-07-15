#!/usr/bin/env bash
# Packages extension/ into two zips, one per browser, since Chrome and
# Firefox need different manifest.json content (service_worker vs scripts
# background, gecko id) from the same background.js/options.*.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$DIR/dist"
COMMON_FILES=(background.js options.html options.js options.css)

rm -rf "$DIST"
mkdir -p "$DIST/chrome" "$DIST/firefox"

for f in "${COMMON_FILES[@]}"; do
  cp "$DIR/$f" "$DIST/chrome/$f"
  cp "$DIR/$f" "$DIST/firefox/$f"
done

cp "$DIR/manifest.json" "$DIST/chrome/manifest.json"
cp "$DIR/manifest.firefox.json" "$DIST/firefox/manifest.json"

(cd "$DIST/chrome" && zip -qr "../macremote-extension-chrome.zip" .)
(cd "$DIST/firefox" && zip -qr "../macremote-extension-firefox.zip" .)

echo "Built:"
echo "  $DIST/macremote-extension-chrome.zip"
echo "  $DIST/macremote-extension-firefox.zip"
