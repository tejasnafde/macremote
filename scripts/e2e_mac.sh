#!/usr/bin/env bash
# macremote end-to-end test against the LIVE launchd service on this Mac.
# Really changes volume/brightness (and restores them). Skips destructive
# actions (lock/sleep) unless --destructive.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="$(grep -m1 '^PORT=' "$REPO/server/.env" | cut -d= -f2- || echo 8484)"
TOKEN="$(grep -m1 '^API_TOKEN=' "$REPO/server/.env" | cut -d= -f2-)"
BASE="http://127.0.0.1:${PORT:-8484}"
AUTH="Authorization: Bearer $TOKEN"
DESTRUCTIVE="${1:-}"

PASS=0; WARN=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
warn() { WARN=$((WARN+1)); echo "  ⚠️  $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

code() { curl -s -o /tmp/e2e_body -w '%{http_code}' -m 6 -H "$AUTH" "$@"; }

echo "== macremote E2E against $BASE =="

# 1. health / version (unauthenticated)
[ "$(curl -s -o /dev/null -w '%{http_code}' -m 4 "$BASE/health")" = 200 ] && ok "GET /health 200" || bad "GET /health"
V="$(curl -sf -m 4 "$BASE/version" | tr -d '"{}' )" && ok "GET /version -> $V" || bad "GET /version"

# 2. auth is enforced
C="$(curl -s -o /dev/null -w '%{http_code}' -m 4 "$BASE/status")"
{ [ "$C" = 401 ] || [ "$C" = 403 ]; } && ok "unauthenticated /status rejected ($C)" || bad "auth NOT enforced on /status ($C)"

# 3. status shape
C="$(code "$BASE/status")"
if [ "$C" = 200 ] && jq -e 'has("volume") and has("muted") and has("brightness") and has("battery") and has("sleep_timer")' /tmp/e2e_body >/dev/null 2>&1; then
  ok "GET /status 200 with expected fields: $(cat /tmp/e2e_body)"
else
  bad "GET /status shape (code $C: $(cat /tmp/e2e_body))"
fi

# 4. absolute volume set + OS readback + restore
ORIG_VOL="$(osascript -e 'output volume of (get volume settings)')"
TARGET=37; [ "$ORIG_VOL" = 37 ] && TARGET=42
C="$(code -X PUT -H 'Content-Type: application/json' -d "{\"level\":$TARGET}" "$BASE/volume")"
sleep 1
GOT="$(osascript -e 'output volume of (get volume settings)')"
if [ "$C" = 200 ] && [ "$GOT" = "$TARGET" ]; then ok "PUT /volume $TARGET verified by osascript readback"; else bad "PUT /volume (code $C, wanted $TARGET, OS says $GOT)"; fi

# 5. volume up/down/mute round-trip
C1="$(code -X POST "$BASE/volume/up")"; C2="$(code -X POST "$BASE/volume/down")"
[ "$C1" = 200 ] && [ "$C2" = 200 ] && ok "volume up/down 200" || bad "volume up/down ($C1/$C2)"
C1="$(code -X POST "$BASE/volume/mute")"; MUTED="$(osascript -e 'output muted of (get volume settings)')"
C2="$(code -X POST "$BASE/volume/mute")"   # unmute (toggle)
[ "$C1" = 200 ] && [ "$MUTED" = "true" ] && ok "mute verified by osascript" || bad "mute (code $C1, OS muted=$MUTED)"
osascript -e "set volume output volume $ORIG_VOL" && ok "volume restored to $ORIG_VOL"

# 6. media keys (need Hammerspoon Accessibility; warn-only)
C="$(code -X POST "$BASE/media/playpause")"
if [ "$C" = 200 ]; then
  sleep 1; code -X POST "$BASE/media/playpause" >/dev/null  # toggle back
  ok "media playpause 200 (x2 toggle-back)"
else
  warn "media playpause -> $C. Likely Hammerspoon Accessibility not granted yet (System Settings → Privacy & Security → Accessibility)."
fi
for ep in next previous; do
  C="$(code -X POST "$BASE/media/$ep")"
  [ "$C" = 200 ] && ok "media $ep 200" || warn "media $ep -> $C"
done

# 7. brightness round-trip
C1="$(code -X POST "$BASE/brightness/up")"; C2="$(code -X POST "$BASE/brightness/down")"
[ "$C1" = 200 ] && [ "$C2" = 200 ] && ok "brightness up/down 200" || warn "brightness ($C1/$C2) — external displays have no software brightness"

# 8. sleep timer set / visible / cancel (60m — never fires during test)
C="$(code -X POST -H 'Content-Type: application/json' -d '{"minutes":60}' "$BASE/sleep-timer")"
R="$(code "$BASE/status"; true)"; REMAIN="$(jq -r '.sleep_timer.remaining_seconds // .sleep_timer // empty' /tmp/e2e_body 2>/dev/null)"
CD="$(code -X DELETE "$BASE/sleep-timer")"
CG="$(code "$BASE/status")"; AFTER="$(jq -r '.sleep_timer' /tmp/e2e_body 2>/dev/null)"
if [ "$C" = 200 ] && [ -n "$REMAIN" ] && [ "$REMAIN" != "null" ] && [ "$CD" = 200 ] && [ "$AFTER" = "null" ]; then
  ok "sleep-timer set (remaining ${REMAIN}s) + cancel verified"
else
  bad "sleep-timer flow (set $C, remaining '$REMAIN', delete $CD, after '$AFTER')"
fi

# 9. cursor banish (harmless: parks the pointer in the corner)
C="$(code -X POST "$BASE/system/banish-cursor")"
[ "$C" = 200 ] && ok "system banish-cursor 200" || bad "system banish-cursor ($C)"

# 10. destructive (opt-in)
if [ "$DESTRUCTIVE" = "--destructive" ]; then
  C="$(code -X POST "$BASE/system/lock")"
  [ "$C" = 200 ] && ok "system lock 200 (screen should be locked!)" || bad "system lock ($C)"
else
  echo "  ➖ skipping /system/lock and /system/sleep (run with --destructive)"
fi

echo "== E2E done: $PASS pass, $WARN warn, $FAIL fail =="
[ "$FAIL" = 0 ]
