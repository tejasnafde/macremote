# macremote

Self-hosted remote control for your Mac from your Android phone. FastAPI server
on the Mac drives Hammerspoon (media keys, volume, brightness, lock, sleep,
sleep timer); an Expo/React Native app + home-screen widget is the client.
Reachable from anywhere via Tailscale. Free everywhere: no cloud backend, APKs
ship as GitHub Releases, CI on free public-repo Actions, Discord webhooks for
all operational alerts.

**This is a strictly personal project.** Identity rules:
- GitHub account: `tejasnafde`. Git author: `Tejas Nafde <nafdetejas@gmail.com>` (pinned in `.git/config`).
- NEVER involve work identities: no `geoiq`, no `tejas44`, no `@geoiq.io`
  anywhere — commits, configs, CI, docs, or cloud resources.
- No Google Cloud resources at all. If gcloud is ever unavoidable, use
  `--configuration personal`.

## Layout

- `server/` — Python 3.12+ FastAPI service that runs ON the Mac (never cloud-hosted).
  Layered like `someday-api`: `routers/` → `handler/` → `common_helper/` + `app_util/` + `config/`.
- `app/` — Expo React Native Android app + `react-native-android-widget` home-screen widget.
- `hammerspoon/` — Lua module loaded by Hammerspoon; the server talks to it via the `hs` IPC CLI.
- `ops/` — launchd plists, install/uninstall/update scripts for the Mac service.
- `scripts/` — dev/release helpers (`ship.sh`, `e2e_mac.sh`).
- `docs/plans/` — design docs and THE implementation plan (see Resume protocol).

## Conventions (codified from `someday`, the ops reference)

- **Config**: pydantic-settings reading `.env` (gitignored). `.env.example`
  committed with placeholders. NO SECRETS IN GIT, ever — this repo is public.
- **Logging**: `app_util/log_util.py` — ANSI dev formatter when `APP_ENV=dev`,
  JSON otherwise; rotating file logs under `~/Library/Logs/macremote/`.
  Loggers: `infologger`, `errorlogger`.
- **Discord**: `common_helper/discord_alert.py` — async fire-and-forget embeds;
  silently no-ops when `DISCORD_WEBHOOK_URL` is unset. Alert on: unhandled
  exceptions/5xx, server start, update applied/rolled back, release published,
  CI failure, sleep-timer fired.
- **Errors**: HTTP middleware catches everything → log + Discord + clean JSON error.
  `@log_timing` decorator on every handler.
- **Auth**: static bearer token (`API_TOKEN` in `.env`) on all endpoints except
  `/health` and `/version`. Tailscale is the outer wall; the token is defense-in-depth.
- **Testing**: pytest for the server (Hammerspoon shimmed via a fake `hs` binary);
  `tsc --noEmit` for the app. CI gates every release: red tests = no APK.
- **Git**: merge, never rebase. Small, frequent commits — the repo is the
  checkpoint store for agent resumability.
- **Releases**: tag `vX.Y.Z` → GitHub Actions: tests → Expo prebuild + Gradle
  signed APK → GitHub Release with APK asset → Discord notification with
  download link. `scripts/ship.sh` bumps version + pushes the tag; CI does the rest.
- **Self-update**: the app checks GitHub `/releases/latest` (`isNewer()` semver
  compare) and installs via Android intent; the Mac server has a launchd-timed
  updater that pulls new tags, reinstalls, restarts, health-checks, and rolls
  back + alerts on failure.

## Running

- Server (dev): `cd server && uv sync && APP_ENV=dev uv run uvicorn main:app --reload --host 0.0.0.0 --port 8484`
- Server tests: `cd server && uv run pytest`
- Mac E2E (real machine, real volume changes): `scripts/e2e_mac.sh`
- App typecheck: `cd app && npm run typecheck`

## Resume protocol (for any agent picking this up)

1. Read `docs/plans/implementation-plan.md` — numbered tasks with acceptance
   criteria and `[ ]/[x]` status. It is the single source of truth for progress.
2. `git log --oneline -20` to see what actually landed.
3. Continue the first unchecked task. Update checkboxes and commit as you go —
   plan updates ride along with the code commits they describe.
4. Machine-specific state that is NOT in git (webhook URL, API token, keystore)
   lives in `server/.env` and `~/.macremote/` on this Mac, and in GitHub Actions
   secrets (`DISCORD_WEBHOOK_URL`, `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) for CI.
