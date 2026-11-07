# Google Play submission (macremote: Remote for Mac)

Status on 2026-11-07: **submitted, In review** (Play Console app id
`4973925884914018466`, production release 0.5.7 (27), 178 countries). App
content says "You're all caught up". The full console log is
`/Users/Shared/macremote-play/console-report.md`.

How it got there: the first runs collided with another agent on the shared
Chromium, then the computer-use tool required the user's confirmation inside
the Codex session for each legal agreement (Create app boxes, IARC terms); it
was passed as the direct reply via `codex exec resume`. A starved Chromium tab
went blank twice; a fresh tab fixed it. `.codex-jdhs` hit its usage limit and
the last run finished on `.codex-default` (`gpt-6-luna`).

## Ready

| Item | Where |
|---|---|
| Play AAB 0.5.7 (versionCode 27), package `app.tn07.macremote` | `/Users/Shared/macremote-play/macremote-play-0.5.7.aab` |
| Upload key SHA-256 | `AB:9F:29:6C:BA:DC:81:58:B9:60:B5:47:B3:D2:35:07:7D:FF:2E:64:11:A2:34:AA:F8:D8:73:A7:24:4C:36:12` (`~/.macremote/release.keystore`, the same key as the GitHub APK) |
| Icon 512, feature graphic 1024x500, 6 phone screenshots | `/Users/Shared/macremote-play/media/` |
| Foreground-service demo video | https://github.com/tejasnafde/macremote/releases/download/v0.5.7/macremote-media-notification-demo.mp4 |
| Privacy policy | https://tn07.dev/privacy#macremote (live) |
| Console prompt with every answer, listing text and the Admin's written authorisation | `docs/plans/assets/2026-11-07-play-console-prompt.md` |
| Last console report | `/Users/Shared/macremote-play/console-report.md` |

The `play` flavor (`5b17b5c`) removes the self-updater and
`REQUEST_INSTALL_PACKAGES`. Its merged manifest asks only for INTERNET,
POST_NOTIFICATIONS, FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PLAYBACK.
Build it with `JAVA_HOME=/Users/Shared/macremote-play/jdk/Contents/Home ./gradlew bundlePlayRelease`
(this Mac has no other JDK).

## Decisions

- Store name "macremote: Remote for Mac" ("Mac" only in the descriptive form).
- All countries. Free. Category Tools. Target audience 18+.
- Data safety: no user data collected or shared. The app talks only to the
  server the user runs on their own Mac.
- App access: restricted, no credentials; instructions point to the server
  README and the demo video. Known risk: reviewers have no Mac.
- The Admin (Tejas) authorised, in writing on 2026-11-07, for this app only:
  the Developer Program Policies and US export laws boxes on Create app, the
  IARC terms, Play App Signing with a Google key, and the production submission.

## Fixed before submission (all in v0.5.7)

- Media notification republished every 5 s, which kept OxygenOS System UI near
  50% CPU; now only on change (`3587c91`). A playing session still costs ~25%
  System UI CPU on OxygenOS, which is the OS live card, not the app.
- A quick second play/pause was lost in the notification (`3587c91`) and in the
  app (`e1c97d7`).
- The token field offered Google Password Manager (`cd091ed`).
- Gmail showed as browser media because of its notification-sound elements
  (`29e0a4a`, extension).

## Resume

1. Make sure no other agent is using the GCP Chromium profile
   (`pgrep -fl "codex exec"`, and ask). Close unrelated tabs; leave one tab on
   https://play.google.com/console/u/1/developers/6372180167942437023/home
2. Rerun the console prompt with the flags in the `app-store-publish` skill,
   `references/computer-use.md` (home `~/.codex-jdhs`, model `gpt-6.1-sol`).
3. Check the report, then the app's Publishing overview for "In review".
