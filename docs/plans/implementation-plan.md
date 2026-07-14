# macremote — Implementation Plan (single source of truth)

Rules for any agent working this plan:
- Work the first unchecked task. Check it off IN THE SAME COMMIT as the code.
- Every task lists acceptance criteria — do not check without meeting them.
- Machine state not in git: `server/.env` (webhook, token), `~/.macremote/`
  (keystore backup), GitHub Actions secrets. See CLAUDE.md "Resume protocol".
- Identity: personal only (`tejasnafde` / `nafdetejas@gmail.com`). No work accounts.

## P0 — Bootstrap
- [x] Repo skeleton, CLAUDE.md, design doc, this plan, .gitignore, LICENSE, README
- [ ] GitHub repo `tejasnafde/macremote` (public) created, pushed
- [ ] Actions secret `DISCORD_WEBHOOK_URL` set; signing keystore generated
      (`keytool`), backed up to `~/.macremote/release.keystore`, uploaded as
      `ANDROID_KEYSTORE_B64` + password/alias secrets

## P1 — Server core (pure Python, no Mac deps; pytest green = done)
- [x] `server/` scaffold: `pyproject.toml` (uv), `main.py`, layered dirs
- [x] `config/settings.py` — pydantic-settings: `APP_ENV`, `API_TOKEN`,
      `DISCORD_WEBHOOK_URL`, `HS_BIN` (path to hs CLI, default `/opt/homebrew/bin/hs`),
      `PORT` (8484), `VOLUME_STEP` (6), `LOG_DIR`
- [x] `app_util/log_util.py` — dev/JSON formatters + rotating file handler
- [x] `common_helper/discord_alert.py` — `alert()`, `send_lifecycle()`; httpx
      async, 5s timeout, no-op if unset, never raises
- [x] `common_helper/decorators.py` — `@log_timing`
- [x] `common_helper/hs_bridge.py` — `run_hs(lua: str) -> str` via subprocess
      (`HS_BIN -c`), 5s timeout, raises `HSError` on failure
- [x] Routers+handlers: media, volume (incl. `PUT /volume`), brightness,
      system (lock/sleep), sleep_timer (asyncio task, fade last 60s, cancel,
      remaining), status (now-playing, volume, brightness, battery, timer),
      health/version (version read from `server/VERSION`)
- [x] Bearer-token dependency on all routers except health/version
- [x] Error middleware: log + Discord + `{"error": ...}` JSON; startup event →
      Discord "server online vX.Y.Z"
- [x] Tests: fake `hs` script fixture; auth (401/200), every endpoint happy path,
      hs failure → 502 + alert called, sleep-timer set/cancel/expiry (fast clock),
      status shape. Acceptance: `uv run pytest` green.

## P2 — Mac integration (this Mac; e2e green = done)
- [ ] `hammerspoon/macremote.lua` + loader line in `~/.hammerspoon/init.lua`;
      enable `hs.ipc` CLI install
- [ ] `server/.env` created locally (API token generated, Discord webhook from user)
- [ ] `ops/io.macremote.server.plist` + `ops/install.sh` (idempotent): uv sync,
      install plists into `~/Library/LaunchAgents`, bootstrap service, open
      Hammerspoon once
- [ ] `scripts/e2e_mac.sh`: hits every endpoint on the live service; verifies
      volume set/readback via `osascript -e 'output volume of (get volume settings)'`;
      verifies auth rejection; verifies /status fields; 60s sleep-timer set+cancel.
      Acceptance: script exits 0 on this Mac; "server online" embed seen in Discord.
- [ ] MANUAL (user): grant Hammerspoon Accessibility permission when prompted.
      Media-key assertions are skipped (warn) until granted, then re-run.

## P3 — CI + release pipeline
- [ ] `.github/workflows/ci.yml`: on push/PR — server pytest; app `tsc --noEmit`
      (once app exists). Failure → Discord notify (curl, secret webhook).
- [ ] `.github/workflows/release.yml`: on tag `v*` — run tests; `npx expo prebuild
      --platform android`; Gradle `assembleRelease` signed with keystore from
      secrets; `gh release create` with APK asset; Discord embed with direct
      download link + version + changelog snippet.
- [ ] `scripts/ship.sh`: bump `server/VERSION` + `app/app.json` version, commit,
      tag, push (merge-pull first if behind). Acceptance: test tag `v0.0.1`
      produces a GitHub Release with signed APK and a Discord notification.

## P4 — Android app + widget
- [ ] Expo scaffold in `app/` (TypeScript, dark theme), deps: expo-file-system,
      expo-intent-launcher, react-native-android-widget
- [ ] `lib/api.ts` — typed client, bearer token, timeouts, error toasts
- [ ] Remote screen: media row, volume rocker + mute, brightness, lock, sleep,
      sleep-timer picker with live countdown, now-playing card (poll /status 3s)
- [ ] Settings screen: server URL + token (AsyncStorage), connection test,
      current version, check-for-update button
- [ ] Self-update: `lib/updater.ts` (isNewer semver) + `lib/apk.ts`
      (download GitHub release asset → install intent), adapted from scout
- [ ] Widget: ⏮ ▶️ ⏭ 🔉 🔊 via react-native-android-widget, headless HTTP
- [ ] App icon: new flat ⌘+play mark (SVG in docs/brand/), adaptive icon set
- [ ] Acceptance: `npm run typecheck` green; APK builds in release workflow.

## P5 — Server auto-update
- [ ] `ops/update.sh`: fetch tags → newer than `server/VERSION`? → `git pull`
      (merge) → `uv sync` → restart service → 10× health poll → on fail:
      checkout previous tag, restart, Discord ❌; on success Discord ✅
- [ ] `ops/io.macremote.updater.plist` (StartInterval 300)
- [ ] Acceptance: simulated flow — check out older tag locally, run update.sh,
      observe pull→restart→✅ embed.

## P6 — v0.1.0 release (the finish line)
- [ ] README: screenshots, install (Mac + APK + Tailscale), API table, brand
- [ ] Full pass: pytest + e2e_mac.sh green, CI green on main
- [ ] `scripts/ship.sh 0.1.0` → tag → CI builds/signs APK → GitHub Release →
      **Discord webhook received by user with installable APK link** ← STOP CONDITION
- [ ] Post-release manual checklist for user: install APK, Tailscale login on
      both devices, Hammerspoon Accessibility grant (if not yet done)
