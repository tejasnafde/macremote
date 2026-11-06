Publish the new Android app "macremote: Remote for Mac" to Google Play and send it for review. Use computer use in Chromium. Work only in the Play Console.

FIRST read, in full, and follow: /Users/tejas/Desktop/projects/tejas-skills/skills/app-store-publish/SKILL.md and its references before-the-console.md, google-play.md, play-signing-and-release.md, computer-use.md, handoff.md. Live UI wording beats the references.

## Browser and account
- Use the Chromium window that is already open on Google Play Console (URL contains /console/u/1/developers/6372180167942437023/). That is the "GlycoCare" organization account, id 6372180167942437023. If no such window is open, open the GCP profile with: open -na /Applications/Chromium.app --args --user-data-dir=$HOME/.gcp-chromium-profile and go to https://play.google.com/console/u/1/developers/6372180167942437023/app-list
- Keep ONE Chromium tab. This Mac has 8 GB RAM.
- The account holds other apps (GlycoCare's and ours). Do not open, change, or touch any other app, any account-level setting, users and permissions, payments, or API access.
- Upload files only from /Users/Shared (Chromium cannot open ~/Desktop files). In the file picker use Cmd+Shift+G, paste the full path, Enter.

## Authorisation (action-time confirmation, from the account Admin, given in writing on 2026-11-07)
Tejas Nafde, Admin of the GlycoCare Play account (tejas@glycocare.in), authorises you, for the new app "macremote: Remote for Mac" (package app.tn07.macremote) ONLY, to:
1. tick "Confirm app meets the Developer Program Policies" on the Create app form,
2. tick "Accept US export laws" on the Create app form,
3. accept the IARC content rating terms for this app,
4. create the app, complete all its setup sections and declarations listed below, accept Play App Signing with a Google-generated app signing key (our AAB is signed with our upload key), create a PRODUCTION release with the AAB below, set countries, and press "Send N changes for review" / submit the first release for review, including all first-time setup bundled in that submission.
Nothing else on the account is authorised. Do not publish any other app's pending changes. If "Send for review" would include changes for another app, stop and report.

## App facts (verified from the code)
- Name: macremote: Remote for Mac   (25 chars). Default language: English (United States) en-US. App (not game). Free.
- Package: app.tn07.macremote. Version 0.5.7, versionCode 27. minSdk 24, targetSdk 36.
- AAB: /Users/Shared/macremote-play/macremote-play-0.5.7.aab (upload key SHA-256 AB:9F:29:6C:BA:DC:81:58:B9:60:B5:47:B3:D2:35:07:7D:FF:2E:64:11:A2:34:AA:F8:D8:73:A7:24:4C:36:12). If Create app or the upload asks to verify package ownership (Android developer verification), follow the UI; if it needs something you cannot do, stop that step and report exactly what it asks.
- What it is: a phone remote for the user's own Mac. The user installs the open-source macremote server on their Mac (https://github.com/tejasnafde/macremote). The app talks only to that server, over the user's local network or their own Tailscale network, using a server address and API token the user enters. It sends commands (play/pause, next, previous, seek, volume, brightness, sleep timer, lock, scroll) and shows status the Mac reports (now playing, volume, battery, browser tabs that play media).
- No account, no sign-in, no ads, no ad SDK, no analytics, no crash reporting, no in-app purchases, no user-generated content shared with other users, no location, no contacts, no camera/mic. The developer receives no data. The server address and token are stored on the phone only (token in Android Keystore-backed encrypted storage).
- Permissions in the Play build: INTERNET, POST_NOTIFICATIONS, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK. No REQUEST_INSTALL_PACKAGES, no AD_ID.
- Foreground service (type mediaPlayback): the optional "Media notification" switch on the Devices screen starts MediaControlService. It shows a media-style notification and lock-screen / quick-settings media controls (play/pause, next, previous) that control playback on the user's Mac. It runs only while the user keeps that switch on. Demo video: https://github.com/tejasnafde/macremote/releases/download/v0.5.7/macremote-media-notification-demo.mp4 . If the form only accepts a YouTube link, stop that one field and report.
- Privacy policy: https://tn07.dev/privacy#macremote  (live). Data deletion: nothing is held by the developer; uninstalling removes all data.
- Target audience: 18 and over only. Not designed for children.
- Content rating: utility / tool app. No violence, sex, language, drugs, gambling, user interaction or content sharing, no location sharing, no purchases, no unrestricted web access inside the app.
- Ads: No. Government app: No. Financial features: none. Health: none. News: no. Advertising ID: not used.
- Data safety: the app does not collect or share any of the listed user data types (nothing is sent to the developer or third parties; commands go only to the user's own Mac server). If the form insists on encryption-in-transit: traffic goes to the user's own server; it is encrypted when the user uses Tailscale, and may be plain HTTP on a home LAN, so answer "No" to "all user data encrypted in transit" only if that question appears for collected data. Record in the report exactly what you answered.
- App access (Sign in details): choose that some functionality is restricted. No credentials exist. Instructions (paste exactly):
  "macremote is a remote control for the user's own Mac. It needs the free, open-source macremote server running on a Mac (https://github.com/tejasnafde/macremote, see README for install). On first launch, enter the Mac's address (for example http://192.168.1.20:8484) and the API token from the server's .env file, then tap Save. The app has no accounts and no sign-in. Without a Mac, the setup screen is all that loads. A demo of the media controls is here: https://github.com/tejasnafde/macremote/releases/download/v0.5.7/macremote-media-notification-demo.mp4"
- Store settings: category Tools. Tags: pick relevant available ones (remote control, media player controls) if offered. Contact email and website: open the existing app "scout: jobs matched to you" store settings READ-ONLY and reuse the same contact email and website; change nothing in scout. Phone: leave empty unless required.
- Countries: all countries / regions available.

## Store listing text (use exactly)
Short description (80 max):
Control your Mac's media, volume and brightness from your Android phone.

Full description:
macremote turns your Android phone into a remote for your own Mac.

Play and pause, skip tracks and seek in Spotify, Apple Music, YouTube and other browser media. Change the Mac's volume and screen brightness, including external displays. Set a sleep timer that fades the volume and pauses playback, lock the Mac, or scroll and turn pages from the couch.

How it works: install the free, open-source macremote server on your Mac (github.com/tejasnafde/macremote). The app talks directly to your Mac over your home network or your own Tailscale network. There is no account, no cloud service, no ads and no tracking.

Optional media notification: control your Mac from the lock screen and quick settings.

Requires a Mac running the macremote server.

## Graphics (all in /Users/Shared/macremote-play/media/)
- App icon: icon-512.png (512x512)
- Feature graphic: feature-graphic.png (1024x500)
- Phone screenshots, in THIS order: 02-remote.png, 03-controls.png, 05-displays.png, 04-sleep-timer.png, 06-devices.png, 01-connect.png
- Asset provenance (AI declaration): screenshots are real app captures; the icon is the app's own launcher icon; the feature graphic was composed in code from that icon and a system font. None is AI-generated.

## Release
- Production track, new release, upload the AAB, release name "0.5.7 (27)", release notes en-US: "First release on Google Play."
- Then review the release, fix any errors it lists (warnings are OK, record them), and send for review as authorised above.

## Report
Write /Users/Shared/macremote-play/console-report.md as you go (not only at the end): each section, what you entered, Save evidence, every declaration answer, any warning text, anything you could not do and why, and the final status (for example "In review"). No passwords or tokens in it. If you must stop, leave the report with an exact resume step.
