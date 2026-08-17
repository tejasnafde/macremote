#!/usr/bin/env bash
# Release macremote: bump versions, tag, push. CI does the rest
# (tests -> signed native APK -> GitHub Release -> Discord notification).
set -euo pipefail

V="${1:?usage: ship.sh X.Y.Z}"
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must be X.Y.Z"; exit 1; }

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

git checkout main
git pull --no-rebase origin main   # merge, never rebase

echo "$V" > server/VERSION
ANDROID_BUILD="app/android/app/build.gradle.kts"
CURRENT_CODE="$(sed -n 's/.*versionCode = \([0-9][0-9]*\).*/\1/p' "$ANDROID_BUILD" | head -1)"
NEXT_CODE="$((CURRENT_CODE + 1))"
sed -E -i.bak \
  -e "s/versionCode = [0-9]+/versionCode = $NEXT_CODE/" \
  -e "s/versionName = \"[^\"]+\"/versionName = \"$V\"/" \
  "$ANDROID_BUILD"
rm -f "$ANDROID_BUILD.bak"

# The extension manifests must move too. AMO rejects a re-upload of a version it
# already has ("Version 0.1.0 already exists"), so leaving these pinned made the
# release workflow's sign-extension job fail on every single tag.
for M in extension/manifest.json extension/manifest.firefox.json; do
  [ -f "$M" ] || continue
  jq --arg v "$V" '.version = $v' "$M" > /tmp/manifest.$$ && mv /tmp/manifest.$$ "$M"
done

git add server/VERSION "$ANDROID_BUILD" extension/manifest.json extension/manifest.firefox.json 2>/dev/null \
  || git add server/VERSION
git commit -m "Release v$V"
git tag "v$V"
git push origin main --tags
echo "==> v$V pushed. Watch: gh run watch  (Discord will announce the APK)"
