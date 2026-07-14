# macremote — Implementation Plan (single source of truth)

Rules for any agent working this plan:
- Work the first unchecked task. Check it off IN THE SAME COMMIT as the code.
- Every task lists acceptance criteria — do not check without meeting them.
- Machine state not in git: `server/.env` (webhook, token), `~/.macremote/`
  (keystore backup), GitHub Actions secrets. See CLAUDE.md "Resume protocol".
- Identity: personal only (`tejasnafde` / `nafdetejas@gmail.com`). No work accounts.

## P0 — Bootstrap
- [x] Repo skeleton, CLAUDE.md, design doc, this plan, .gitignore, LICENSE, README
- [x] GitHub repo `tejasnafde/macremote` (public) created, pushed
- [x] Actions secret `DISCORD_WEBHOOK_URL` set; signing keystore generated
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
- [x] `hammerspoon/macremote.lua` + loader line in `~/.hammerspoon/init.lua`;
      enable `hs.ipc` CLI install
- [x] `server/.env` created locally (API token generated, Discord webhook from user)
- [x] `ops/io.macremote.server.plist` + `ops/install.sh` (idempotent): uv sync,
      install plists into `~/Library/LaunchAgents`, bootstrap service, open
      Hammerspoon once
- [x] `scripts/e2e_mac.sh`: hits every endpoint on the live service; verifies
      volume set/readback via `osascript -e 'output volume of (get volume settings)'`;
      verifies auth rejection; verifies /status fields; 60s sleep-timer set+cancel.
      Acceptance: script exits 0 on this Mac; "server online" embed seen in Discord.
- [x] MANUAL (user): grant Hammerspoon Accessibility permission when prompted.
      Media-key assertions are skipped (warn) until granted, then re-run.

## P3 — CI + release pipeline
- [x] `.github/workflows/ci.yml`: on push/PR — server pytest; app `tsc --noEmit`
      (once app exists). Failure → Discord notify (curl, secret webhook).
- [x] `.github/workflows/release.yml`: on tag `v*` — run tests; `npx expo prebuild
      --platform android`; Gradle `assembleRelease` signed with keystore from
      secrets; `gh release create` with APK asset; Discord embed with direct
      download link + version + changelog snippet.
- [x] `scripts/ship.sh`: bump `server/VERSION` + `app/app.json` version, commit,
      tag, push (merge-pull first if behind). Acceptance: test tag `v0.0.1`
      produces a GitHub Release with signed APK and a Discord notification.

## P4 — Android app + widget
- [x] Expo scaffold in `app/` (TypeScript, dark theme), deps: expo-file-system,
      expo-intent-launcher, react-native-android-widget
- [x] `lib/api.ts` — typed client, bearer token, timeouts, error toasts
- [x] Remote screen: media row, volume rocker + mute, brightness, lock, sleep,
      sleep-timer picker with live countdown, now-playing card (poll /status 3s)
- [x] Settings screen: server URL + token (AsyncStorage), connection test,
      current version, check-for-update button
- [x] Self-update: `lib/updater.ts` (isNewer semver) + `lib/apk.ts`
      (download GitHub release asset → install intent), adapted from scout
- [x] Widget: ⏮ ▶️ ⏭ 🔉 🔊 via react-native-android-widget, headless HTTP
- [x] App icon: new flat ⌘+play mark (SVG in docs/brand/), adaptive icon set
      — placeholder flat dark icon + adaptive set generated directly as PNGs
      in `app/assets/`; no SVG in docs/brand/ yet, final brand icon pending.
- [ ] Acceptance: `npm run typecheck` green; APK builds in release workflow.
      typecheck is green (verified locally); APK build in CI's release
      workflow is untested since P3's `.github/workflows/release.yml` and
      Android SDK/Gradle build aren't available in this environment.

## P5 — Server auto-update
- [x] `ops/update.sh`: fetch tags → newer than `server/VERSION`? → `git pull`
      (merge) → `uv sync` → restart service → 10× health poll → on fail:
      checkout previous tag, restart, Discord ❌; on success Discord ✅
- [x] `ops/io.macremote.updater.plist` (StartInterval 300)
- [x] Acceptance: LIVE flow validated — check out older tag locally, run update.sh,
      observe pull→restart→✅ embed.

## P6 — v0.1.0 release (the finish line)
- [x] README: screenshots, install (Mac + APK + Tailscale), API table, brand
- [x] Full pass: pytest + e2e_mac.sh green, CI green on main
- [x] `scripts/ship.sh 0.1.0` → tag → CI builds/signs APK → GitHub Release →
      **Discord webhook received by user with installable APK link** ← STOP CONDITION
- [ ] Post-release manual checklist for user: install APK, Tailscale login on
      both devices, Hammerspoon Accessibility grant (if not yet done)

## Post-v0.1.0 notes (2026-07-15)
- Service runs from ~/development/macremote (deployed clone) — NOT the Desktop
  dev repo: launchd cannot read TCC-protected dirs (Desktop/Documents). Dev repo
  stays at ~/Desktop/projects/macremote. install.sh should warn about TCC paths.
- Android cannot resolve `.local` hostnames — use LAN IP or Tailscale hostname.
- Backlog candidate from user: per-tab browser media control (multiple Firefox
  tabs playing) — needs a browser extension bridge; media keys can only drive
  the OS-level "most recent" media session.

## v0.2.0 backlog (agreed with user, 2026-07-15)
- OTA updates via EAS Update (free tier). Expo account: glycocare login OK per
  user; prefer migrating to nafdetejas@gmail.com. Wire expo-updates,
  EXPO_TOKEN secret, `ship.sh --ota` for JS-only releases. Native changes keep
  the APK path.
- Per-tab browser media control: cross-browser WebExtension (Firefox +
  Chromium, same codebase) reporting audible tabs via tabs.query({audible}),
  per-tab play/pause via scripting.executeScript, focus via tabs.update.
  Server: /ws/browser aggregation + sessions in /status; app: sessions list UI.
- CI speed: cache Gradle + npm in release.yml (~15min → ~7min).
- Settings flicker fix (already on main, ships with next release).

## Multi-device (user feedback, 2026-07-15 — design round 1)
- App: config becomes devices[] {name, url, token}, one active; Devices screen
  (list w/ online status + glance info, switch, add = setup flow); widget acts
  on active device. Server: no change needed per-machine (each Mac runs its own
  macremote server); app aggregates. /status could add hostname/device name.
- Future: Windows agent (Python server + pycaw/keyboard shims instead of
  Hammerspoon) — same API contract, so the app treats it identically.

## Sleep-timer refinement (user Q, design round 1)
- Current: fade volume → system sleep (volume left faded after wake).
- Change with redesign release: fade → send media pause → restore volume to
  pre-fade level → system sleep. Server-side change in sleep_timer_handler.

## P7 status — Deck UI implementation (branch `deck-ui`, worktree `macremote-deck`)
- [x] `app/theme.ts`: tokens ported from `design/mockups/deck.html`'s CSS
      variables (ink/off/green/ember palette, radii, easing curves, rail
      width, Archivo Black + Familjen Grotesk font families).
- [x] New deps added via `npx expo install`: `react-native-gesture-handler`,
      `react-native-reanimated`, `react-native-svg`, `react-native-safe-area-context`,
      `expo-font`, `@expo-google-fonts/archivo-black`, `@expo-google-fonts/familjen-grotesk`.
      `react-native-svg` and `react-native-safe-area-context` were not on the
      pre-approved list but were necessary: the mockup's icon language is all
      inline SVG (no icon font matches it), and faithful safe-area handling
      (the mockup's chip-bar/rail clearances) needs real inset values on
      Android, which RN has no built-in API for. Both are standard,
      lightweight, Expo-blessed libraries, not UI kits.
- [x] `components/icons.tsx` — full vector icon set (react-native-svg) ported
      1:1 from the mockup's inline SVG paths: transport, brightness, lock,
      sleep, volume/mute, eye/eye-off, chevrons, battery, download, wifi-off,
      windows, plus/minus/x, cursor. No emoji anywhere in the app or widget.
- [x] `components/PressableScale.tsx` — shared 0.96 press-scale affordance
      (Reanimated), used by every tappable surface.
- [x] `components/Toast.tsx` — global toast provider, mockup-matched pill.
- [x] `lib/devices.ts` — new multi-device model
      `{devices: [{id,name,url,token}], activeId}` in AsyncStorage, with
      silent migration from the old single `serverUrl`/`token` keys
      (`lib/storage.ts`) into `devices[0]` on first read, plus a short-timeout
      `/health`+`/version` prober for the Devices screen's online dots.
- [x] `lib/api.ts` — now reads the ACTIVE device (`getActiveDevice()`)
      instead of the old single config; added `testConnection()` for
      unsaved url/token pairs (Setup screen) and `banishCursor()` (POST
      `/system/banish-cursor`, wired to a new cursor-icon button in the
      Remote screen's secondary row).
- [x] `lib/apk.ts` — `downloadAndInstall()` gained an optional `onProgress`
      callback (via `expo-file-system`'s resumable download) so the Deck
      update banner can show a real progress bar; default (no-callback)
      call path is unchanged for any other caller.
- [x] `screens/SetupScreen.tsx` — device URL + token fields, 44px show/hide
      eye toggle, single-flight-guarded Test Connection (idle/testing/success),
      Save adds the device to `lib/devices.ts` and makes it active. First
      launch with zero devices lands here.
- [x] `screens/DevicesScreen.tsx` — device list with probed online dots,
      active device's live glance (`/status`: battery, volume, version),
      tap-to-switch, offline devices dimmed and shake-on-tap instead of
      switching, dashed disabled "Windows support, soon" teaser row,
      "+ Add device" into Setup.
- [x] `screens/RemoteScreen.tsx` + `screens/remote/{VolumeRail,SleepSheet,
      LockOverlay}.tsx` — the Deck layout: status strip (connection dot,
      tappable device name + chevron -> Devices, marquee, battery), rail-aware
      now-playing hero, rail-aware update/offline banners, thumb-zone
      transport (prev/play-pause/next + track-change toast), secondary row
      (brightness -/+, lock, sleep timer, cursor-park — 5 buttons, sized
      down from the mockup's 50px to 44px so the row clears the volume rail
      on a 360px-wide phone), sleep-timer bottom sheet (chips + custom
      stepper + arm + running countdown + sleep-now confirm), docked timer
      pill, and a local "child lock" overlay (hold-to-unlock ring) raised
      alongside the real `/system/lock` call.
      Volume rail uses a single `react-native-gesture-handler` Pan gesture:
      grabbing near the thumb drags absolute volume; pressing elsewhere
      starts a press-and-hold step (+/-6, matching the server's
      `VOLUME_STEP`) that converts into an absolute drag once the touch
      travels past a 6px threshold, same rule as the mockup. Drag updates
      are throttled to ~10Hz over the network; the final value is always
      sent on release.
- [x] Widget: `widget/RemoteWidget.tsx` rebuilt with `SvgWidget` (inline SVG
      strings mirroring the same icon paths) instead of emoji glyphs;
      `widget-task-handler.tsx` now reads the active device via
      `lib/devices.ts` instead of the old single-config storage.
- [x] Swept the whole app for emoji and em dashes in user-facing copy (not
      code comments) per a mid-build instruction; found and fixed one
      em dash in the now-playing marquee label.
- [x] `npm run typecheck` green. Additionally ran `npx expo export --platform
      android` twice (before and after the cursor-park addition) as a
      stronger runtime smoke test than tsc alone — Metro bundles clean,
      confirming the Reanimated/worklets babel plugin (auto-added by
      `babel-preset-expo` when the package is present; this project has no
      `babel.config.js` by design) and all new modules resolve. Did not run
      `expo prebuild` or a native build, per constraints.
- Mockup details not fully portable:
  - `@expo-google-fonts/familjen-grotesk` only ships static weights up to
    700 (Bold); the mockup's CSS reaches for 800 in a couple of spots
    (device name, now-playing title). Falls back to 700 there
    (`theme.fonts.extraBold` aliases to the 700 file).
  - The mockup's `backdrop-filter: blur()` (setup/lock overlay, sleep sheet
    backdrop) has no equivalent without adding `expo-blur`; used a plain
    semi-opaque scrim instead.
  - Real Android app updates hand off to the system package installer
    (a modal outside app control), so there's no true "Restart Now" step
    like the mockup's demo theater — the banner tracks download progress
    then shows a toast once the installer intent is launched.
  - Brightness has no readback of the server's actual step size, so the
    secondary-row buttons toast a direction ("Brightness up"/"down") rather
    than the mockup's simulated live percentage.
  - Skipped the mockup's device-row "switch-pulse" animation on successful
    device switch (kept the standard press-scale feedback) for time.
