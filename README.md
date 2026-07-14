# macremote

Your Mac, in your pocket. A self-hosted remote control: an Android app + widget
that drives your Mac's media, volume, brightness, lock, sleep — and a
fall-asleep-to-music sleep timer — over your own Tailscale network. No cloud,
no accounts, no cost.

```text
Android (Expo RN app + widget)
        │  HTTP + bearer token, over Tailscale/LAN
        ▼
FastAPI on the Mac (launchd-managed, self-updating)
        │  Hammerspoon IPC
        ▼
macOS: media keys · volume · brightness · lock · sleep
```

- **Server**: FastAPI + Hammerspoon, runs on the Mac itself (~50 MB RAM)
- **App**: Expo React Native + home-screen widget, self-updates from GitHub Releases
- **Ops**: Discord webhook alerts (errors, updates, releases), rotating logs,
  auto-update on both ends, CI-gated releases

> Status: under active construction toward v0.1.0.
> See `docs/plans/` for the design and the live implementation plan.

## License

MIT — see [LICENSE](LICENSE).
