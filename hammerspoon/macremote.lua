-- macremote Hammerspoon module
-- Loaded from ~/.hammerspoon/init.lua via dofile(). The FastAPI server drives
-- Hammerspoon through the `hs` IPC CLI with stock hs.* calls; this module only
-- provides the IPC socket and the `macremote` global (now-playing helper).

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

hs.printf("macremote module loaded")
