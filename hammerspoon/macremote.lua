-- macremote Hammerspoon module
-- Loaded from ~/.hammerspoon/init.lua via dofile(). The FastAPI server drives
-- Hammerspoon through the `hs` IPC CLI with stock hs.* calls; this module only
-- provides the IPC socket and the `macremote` global (now-playing helper).

require("hs.ipc")
-- ensure the `hs` CLI exists for the server (idempotent)
pcall(function() hs.ipc.cliInstall("/opt/homebrew") end)

macremote = {}

-- Best-effort now-playing info (Spotify / Apple Music); nil when nothing plays.
function macremote.nowPlaying()
  local ok, res = pcall(function()
    if hs.spotify and hs.spotify.isRunning() then
      return {
        app = "Spotify",
        title = hs.spotify.getCurrentTrack(),
        artist = hs.spotify.getCurrentArtist(),
        state = hs.spotify.getPlaybackState(),
      }
    end
    if hs.itunes and hs.itunes.isRunning and hs.itunes.isRunning() then
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
