# Control sync and playback speed

## Problem

The native remote currently exposes several states that look authoritative but
are either stale or ambiguous:

- Firefox reports an empty tab list when no audible or previously-known tab is
  found, and the app cannot distinguish that from a disconnected bridge.
- The installed Firefox bridge can lag behind the server and Android versions
  without either side identifying the mismatch.
- A status poll can replace an optimistic volume value while the user is
  dragging, causing the slider and final command to jump to an older value.
- External gamma dimming is presented as physical monitor brightness and is
  read from server memory even after macOS resets the real gamma table.
- The remote always spends vertical space on a placeholder now-playing card.
- Browser media has no playback-speed control.

## Design

### Browser discovery and health

The extension will inspect three bounded sets: audible tabs, tabs already known
to contain media, and the active tab in each browser window. This discovers an
active paused or silent player without injecting into every open Firefox tab.
Known media tabs remain tracked until they close.

Every report will include the extension version. The server will retain a
browser heartbeat even for an empty report and expose bridge status separately
from media tabs. Android can then say whether Firefox is connected, outdated,
or simply has no detected media.

### Playback speed

The media probe will report the selected element's playback rate. A `setrate`
command will carry an integer percentage across the existing command queue,
avoiding floating-point ambiguity in the wire contract. The accepted range is
100 through 200.

The browser-tab sheet will show eleven compact presets: 1x, 1.1x, 1.2x,
1.3x, 1.4x, 1.5x, 1.6x, 1.7x, 1.8x, 1.9x, and 2x. The live rate is highlighted.
Speed controls are disabled when no media element is controllable.

### Volume synchronization

Android will keep a pending local volume while a drag or committed write is in
progress. Status responses may update the rest of the Mac status, but they may
not replace that pending volume. After the final write succeeds, Android will
request authoritative status and clear the pending value only when the response
belongs to the same volume generation. This prevents an older poll or older
write from winning.

### External display dimming

The server will read the current Hammerspoon gamma white point for external
displays instead of treating the last requested in-memory level as observed
state. The in-memory value remains useful for blackout restoration, but not for
display reporting.

Android will call gamma control `Screen dimming`; `Brightness` remains the label
for the built-in panel and DDC-controlled monitors. This makes clear that an LG
backlight can physically remain at 100 percent while macremote darkens its
framebuffer output.

### Remote layout

The now-playing card will render only when native Spotify or Music metadata is
present. Browser tab cards and the transport controls move up when there is no
native metadata. Browser bridge state will use a compact explanatory row rather
than another large empty card.

### Running apps and refresh stability

Hammerspoon's window list can omit an application's windows when they are on a
different macOS Space even though the running-app list still contains the app.
Android will merge running apps whose bundle IDs are absent from the window
groups, so Firefox remains focusable without duplicating Finder or other apps
that already have visible window rows.

Refresh progress will replace the header's refresh icon inside the same 48 dp
touch target. Existing rows stay in place while data reloads; no temporary list
item will push the whole screen down and pull it back up.

## Error handling and compatibility

All new report fields are optional on the server so v0.4.4 reports continue to
parse. Android also treats missing bridge and playback-rate fields as legacy
state. Invalid `setrate` values are rejected by the server before entering the
command queue.

If an extension probe cannot reach a page or frame, the tab can still be shown
but direct playback, volume, and speed controls remain disabled. System media
keys continue to provide the existing fallback for main play/pause.

## Verification

- JavaScript unit tests cover probing and setting playback rates.
- Server tests cover versioned heartbeats, empty connected reports, playback
  rate serialization, and `setrate` validation.
- JVM tests cover status decoding and pending-volume reconciliation.
- Display tests cover live gamma readback and reset behavior.
- The full server, extension, and native Android test/lint/build suites run.
- The resulting diff receives an adversarial Claude Code review using the
  `tech-team` OAuth profile before handoff.

## Implementation plan

1. Add failing extension tests for rate probing/setting and active-tab discovery.
2. Add failing server tests for bridge heartbeat/version, rate fields, command
   validation, and live gamma readback.
3. Add failing Android tests for new status fields and volume reconciliation.
4. Implement the smallest extension, server, and Android changes that pass.
5. Remove the unconditional media placeholder and relabel gamma control.
6. Run focused tests, then complete project verification.
7. Build the Firefox package and Android artifact, then run the Claude review.
