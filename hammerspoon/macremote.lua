-- macremote Hammerspoon module
-- Loaded from ~/.hammerspoon/init.lua via dofile(). The FastAPI server drives
-- Hammerspoon through the `hs` IPC CLI with stock hs.* calls; this module only
-- provides the IPC socket and the `macremote` global (now-playing helper and
-- the play/pause router, which needs more logic than a one-line snippet).

require("hs.ipc")
-- ensure the `hs` CLI exists for the server (idempotent)
pcall(function() hs.ipc.cliInstall("/opt/homebrew") end)

-- Preload every extension the server's Lua snippets touch. Lazy loading inside
-- an IPC call interleaves "-- Loading extension:" chatter into the CLI stream
-- (breaking JSON parsing) and has been observed to crash HS 1.1.1's libipc on
-- macOS 26. Loading here keeps IPC calls quiet and cheap.
for _, ext in ipairs({
  "eventtap", "audiodevice", "brightness", "battery", "caffeinate",
  "json", "spotify", "itunes", "application", "window", "host",
}) do
  pcall(function() return hs[ext] end)
end

-- macremote is the engine the server drives; it must stay running all day.
-- Start at login automatically and hide the dock icon so it is invisible and
-- the user never has to launch or think about it. (Menubar icon stays so it is
-- discoverable if ever needed.)
pcall(function() hs.autoLaunch(true) end)
pcall(function() hs.dockIcon(false) end)

macremote = {}

-- Is an app already running? hs.application.get(bundleID) returns nil without
-- launching it. hs.spotify.isRunning()/hs.itunes.isRunning() must NOT be used
-- as the gate: they resolve the app via AppleScript, which LaunchServices then
-- STARTS if it is not open (this was spam-launching Apple Music every poll).
local function running(bundleID)
  return hs.application.get(bundleID) ~= nil
end

-- Best-effort now-playing info (Spotify / Apple Music); nil when nothing plays.
-- Only touches an app's scripting API if that app is already running.
function macremote.nowPlaying()
  local ok, res = pcall(function()
    if running("com.spotify.client") then
      return {
        app = "Spotify",
        title = hs.spotify.getCurrentTrack(),
        artist = hs.spotify.getCurrentArtist(),
        state = hs.spotify.getPlaybackState(),
      }
    end
    if running("com.apple.Music") then
      return {
        app = "Music",
        title = hs.itunes.getCurrentTrack(),
        artist = hs.itunes.getCurrentArtist(),
      }
    end
    return nil
  end)
  if ok then return res end
  return nil
end

-- Players the system media key cannot reach. macOS hands the PLAY key to the
-- most recently active "Now Playing" client, and a Firefox tab that has ever
-- played audio wins that race over Stremio (Qt/QtWebEngine), so a Stremio
-- video never toggled (2026-09-17). Stremio also ignores a keystroke posted to
-- its pid without focus (verified live), so the only reliable path is: focus
-- it, press its toggle key, give focus back. Keyed by bundle id -> toggle key.
local FOCUS_PLAYERS = {
  ["com.westbridge.stremio4-mac"] = "space",
}

-- A focus player is the target only when the user is plainly watching it:
-- frontmost, or showing a fullscreen window (Stremio fullscreen on a second
-- display while Firefox stays frontmost is the common case). A player idling
-- in the background must not steal the button from the media key.
local function watchedFocusPlayer()
  for bundleID, key in pairs(FOCUS_PLAYERS) do
    local app = hs.application.get(bundleID)
    if app then
      if app:isFrontmost() then return app, key end
      for _, w in ipairs(app:allWindows()) do
        if w:isFullScreen() then return app, key end
      end
    end
  end
  return nil
end

-- Toggle playback. Returns which path handled it: the focus player's name
-- (e.g. "stremio") or "mediakey" for the system PLAY key.
function macremote.playPause()
  local app, key = watchedFocusPlayer()
  if not app then
    hs.eventtap.event.newSystemKeyEvent("PLAY", true):post()
    hs.eventtap.event.newSystemKeyEvent("PLAY", false):post()
    return "mediakey"
  end
  local prev = hs.application.frontmostApplication()
  if not app:isFrontmost() then
    app:activate(true)
    -- activate() is asynchronous; focus took ~400ms to land when measured.
    for _ = 1, 20 do
      if app:isFrontmost() then break end
      hs.timer.usleep(50000)
    end
  end
  hs.eventtap.keyStroke({}, key, 0)
  if prev and prev:bundleID() ~= app:bundleID() then
    hs.timer.usleep(100000)
    prev:activate()
  end
  return string.lower(app:name())
end

hs.printf("macremote module loaded")
