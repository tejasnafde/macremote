# macremote — Design (approved 2026-07-15)

Self-hosted Mac remote control from Android. Replaces KDE Connect's media
controller with something owned end-to-end. Approved by Tejas on 2026-07-15.

## Decisions (from brainstorming Q&A)

| Decision | Choice | Why |
|---|---|---|
| Network scope | Tailscale (works anywhere) | Free personal plan, same URL on any network, encrypted, no exposed ports. Kills any need for cloud hosting. |
| Backend hosting | The Mac itself, via launchd | The service's job is to press keys on THIS Mac; cloud hosting is impossible by definition. Cost: $0. |
| Client | Expo RN + `react-native-android-widget` | Reuses someday/scout release + self-update machinery; widgets ARE possible in RN (RemoteViews-backed, same constraint as native). Kotlin rejected: slower first ship, no reuse. |
| Release pipeline | Approach A: GitHub-centric | Tag → Actions (pytest+tsc) → Expo prebuild + Gradle signed APK on free runner → GitHub Release → Discord webhook with download link. EAS-cloud-webhook (someday-style) rejected: server is behind Tailscale, unreachable by webhooks; EAS cloud builds are metered. |
| v1 scope | Media, volume, brightness, lock/sleep, sleep timer | User-selected. Arbitrary command runner explicitly deferred (risk surface). |
| Repo | `tejasnafde/macremote`, public monorepo | Open-source-worthy; public forces secret hygiene. Strictly personal identity — no work accounts. |
| Cost | $0 total | No cloud backend; Tailscale/GitHub/Discord free tiers; APK builds via prebuild+Gradle on free public-repo Actions (avoids EAS build metering). |

## Architecture

```text
Android phone (Expo RN app + home-screen widget)
        │  HTTP + bearer token, over Tailscale (any network) or LAN
        ▼
FastAPI server on the Mac  ←— launchd: keep-alive, restart on crash
        │  hs IPC CLI
        ▼
Hammerspoon → media keys, volume, brightness, lock, sleep
        │
Discord webhook ← errors, lifecycle, updates, releases
```

## API surface (v1)

- `POST /media/{playpause|next|previous}`
- `POST /volume/{up|down|mute}`, `PUT /volume {level: 0-100}`
- `POST /brightness/{up|down}`
- `POST /system/{lock|sleep}`
- `POST /sleep-timer {minutes}` — cancellable server task; volume fades over the
  final 60s, then sleeps the Mac. `DELETE /sleep-timer`. Countdown in `/status`.
- `GET /status` — now-playing (title/artist/app), volume, muted, brightness,
  battery %, sleep-timer remaining. App polls while foregrounded.
- `GET /health`, `GET /version` (unauthenticated); everything else requires
  `Authorization: Bearer <API_TOKEN>`.

## Components

- **server/** — FastAPI, someday-api layering (`routers/handler/config/app_util/common_helper`),
  pydantic-settings `.env`, `log_util.py` (dev-color vs JSON + rotating file),
  `discord_alert.py` (embeds, no-op without webhook), `@log_timing`,
  error middleware (log + Discord + JSON error).
- **hammerspoon/macremote.lua** — functions the server invokes through `hs -c`:
  systemKey taps (PLAY/FAST/REWIND/SOUND_UP/SOUND_DOWN/MUTE/BRIGHTNESS_UP/DOWN),
  `hs.caffeinate.lockScreen()`, `systemSleep()`, `hs.audiodevice` for absolute
  volume, now-playing via distributed notifications where available.
- **app/** — screens: Remote (media row, volume, brightness, lock, sleep-timer
  picker, now-playing card) + Settings (server URL, token, check-for-update).
  Widget: ⏮ ▶️ ⏭ 🔉 🔊 buttons → direct HTTP to server. Self-update: GitHub
  `/releases/latest` + `isNewer()` + install intent (adapted from scout).
- **ops/** — `io.macremote.server.plist` (keep-alive service),
  `io.macremote.updater.plist` (StartInterval timer), `install.sh`,
  `update.sh` (fetch tags → pull (merge) → `uv sync` → restart → health-check →
  rollback to previous tag + Discord ❌ on failure; ✅ on success).

## Testing gates

1. **pytest** (CI + local): handlers with Hammerspoon shimmed by a fake `hs`
   binary; middleware/auth/sleep-timer logic covered.
2. **scripts/e2e_mac.sh** (real Mac): actually changes volume and reads it back
   via `osascript`; exercises every endpoint against the live launchd service.
   Must pass before the first release is tagged.
3. **App**: `tsc --noEmit` in CI; APK built in CI for every release.
4. **Definition of done for v0.1.0**: E2E green on this Mac + CI green →
   tag → Discord webhook arrives with installable, signed APK link.

## Brand

Name: `macremote`. Legacy logo (docs/brand/legacy/) rejected as generic.
New direction: flat, single-weight mark fusing ⌘ with a play triangle; no
gradient-on-dark-roundrect. Deliverables: SVG + Android adaptive icon + widget icon.

## Out of scope for v0.1.0 (backlog)

Command runner, clipboard sync, file transfer, seek slider, album art,
CPU/RAM stats, notification mirroring, QS tile, iOS.
