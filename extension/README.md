# macremote Browser Bridge

A WebExtension (one codebase, Manifest V3) that reports your browser's
audible tabs to the local macremote server, so the phone app can see and
control per-tab playback. This exists because macOS locked down the
MediaRemote API the server previously used to see "what's playing" - browser
tabs are otherwise invisible to it.

What it does, every few seconds:
- Collects tabs currently producing sound (`tabs.query({audible: true})`),
  plus any tab it has seen play that is still open (so a paused tab stays
  controllable instead of vanishing from the phone).
- Reads each of those tabs for real state: is the media element paused, its
  volume, and whether the page is fullscreen. `audible` is only a discovery
  hint, never the answer: it is false for a video with no audio track, one at
  volume 0, and any quiet passage. Deriving "playing" from sound drew Play over
  a playing video, and the button then paused it.
- Reports that list to `POST /browser/report` on your macremote server.
- Polls `GET /browser/commands` for play/pause/focus/mute/seek/setvolume
  commands queued by the app and carries them out, then reports again
  immediately so the phone can confirm the icon it drew on tap.

All page work goes through one injected function, `mediaOp`, so the probe and
every command act on the same element. It picks the playing element, else the
longest one, and ignores anything without a finite duration: YouTube keeps
extra `<video>` elements for ads and previews, and targeting one of those made
commands silent no-ops. `node mediaOp.test.mjs` checks that logic.

No build step is required to develop or load the extension; `build.sh` only
exists to produce a distributable zip per browser.

## Load in Chrome (unpacked)

1. Open `chrome://extensions`.
2. Turn on "Developer mode" (top right).
3. Click "Load unpacked" and select this `extension/` directory directly
   (not a zip).
4. The options page opens automatically on install - enter your server URL
   (for example `http://100.x.x.x:8484`, whatever the phone app uses) and
   the API token from `server/.env`, then click "Test connection" and
   "Save".

Chrome only allows extensions loaded this way (unpacked, developer mode) to
schedule alarms faster than once a minute - which is what this extension
relies on for its 5s report / 2s command-poll cadence. A Chrome Web
Store-published build would need a different scheduling strategy.

## Load in Firefox (temporary add-on)

Firefox's Manifest V3 doesn't support `background.service_worker`, so it
needs its own manifest (`manifest.firefox.json`, using
`background.scripts`). To load it:

1. Run `./build.sh` (see below) to stage a Firefox-ready copy at
   `dist/firefox/` (this swaps in `manifest.firefox.json` as `manifest.json`
   alongside the shared JS/HTML/CSS - Firefox's temporary-add-on loader
   reads whichever `manifest.json` sits next to the files you pick).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click "Load Temporary Add-on..." and select `dist/firefox/manifest.json`.
4. Open the extension's options (Firefox opens it in a tab automatically on
   install) and fill in the server URL + token, same as Chrome above.

Temporary add-ons are removed when Firefox restarts - reload them from
`about:debugging` after each restart during development.

## build.sh

`./build.sh` stages `dist/chrome/` and `dist/firefox/` (shared JS/HTML/CSS
plus the matching `manifest.json` for each browser) and zips each into
`dist/macremote-extension-<browser>.zip`. Use the zips for permanent
installs (Chrome Web Store packaging, or Firefox's `web-ext sign`/AMO
submission flow) - for day-to-day development, load the unpacked
directories directly as described above.

## Permissions

`tabs`, `scripting`, `storage`, `alarms`, and `host_permissions` for
`http://*/*` and `https://*/*`. The host permissions cover two needs: plain
HTTP access to your LAN macremote server, and `scripting.executeScript`
access to whichever tab is currently playing media - almost all of which are
HTTPS in practice (YouTube, Spotify Web, etc.), so `http://*/*` alone isn't
enough for the play/pause feature to actually work on real sites.

## Server API this talks to

- `POST /browser/report` - `{browser: "firefox"|"chrome", tabs: [{tab_id,
  title, url_host, audible, muted, playing}]}`. Replaces that browser's
  known tabs wholesale.
- `GET /browser/commands?browser=firefox|chrome` - drains and returns
  `{commands: [{id, tab_id, action}]}` (`action` is `playpause`, `focus`, or
  `mute`).
- `GET /health` - used by the options page's connection test.

All endpoints except `/health` require `Authorization: Bearer <API_TOKEN>`,
the same token as the rest of macremote.
