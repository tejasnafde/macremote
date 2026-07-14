# macremote UI redesign — mockup round 1

User request: 5 functionally different ways to think about the remote — not
theme-swaps, not cringe (explicitly banned: typewriter, cyberpunk, purple-neon
garbage). Dark-first (it's a night-stand app). Each mockup must cover ALL flows.

## Shared spec (every mockup)

- One self-contained HTML file in `design/mockups/`, no build step, vanilla
  JS/CSS only, Google Fonts allowed. Mobile-first, 100dvh, no horizontal scroll,
  feels like an app not a webpage (no visible browser-ish chrome).
- A floating state-switcher chip bar (bottom, small, semi-transparent — it's a
  mockup affordance, visually separate from the design itself) toggling:
  **Setup → Remote → Timer → Playing → Offline → Update**.
- States/flows to design:
  1. **Setup** (first run): server URL + token entry, test connection, success.
  2. **Remote** (main): play/pause/next/prev, volume (steps + mute + absolute
     control), brightness up/down, lock, sleep (confirm), sleep-timer entry.
  3. **Timer**: timer running — countdown visible, cancel, "fades volume over
     the last minute" communicated.
  4. **Playing**: now-playing (title/artist/app/playing-state) prominent.
  5. **Offline**: server unreachable — clear, calm, actionable (retry), controls
     visibly inert.
  6. **Update**: new version available banner/flow (download + install).
- Micro-interactions per `.claude/skills/make-interfaces-feel-better/SKILL.md`:
  tactile press states, spring easings, no dead clicks; every control gives
  visual feedback. Buttons min 44px hit targets; thumb-reachable primaries.
- Production-grade polish per `.claude/skills/impeccable/SKILL.md`.
- Distinct typography + accent per direction. NO Inter/Roboto/system-default
  look, no purple gradients, none of the banned aesthetics.

## The 5 directions (functionally different mental models)

| File | Name | Mental model | Key traits |
|---|---|---|---|
| `deck.html` | **Deck** | A physical remote in your hand | Fixed no-scroll layout, thumb-zone ergonomics, right-edge vertical volume rail, huge central transport cluster, timer as bottom sheet. Heavy grotesque type, macremote green `#4ADE80` accent on deep ink. |
| `nowplaying.html` | **Stage** | A music app that controls your Mac | Now-playing is the hero (big editorial type, breathing gradient atmosphere from album mood), transport below, system controls in a swipe-up tray. Fraunces-style display + humanist body. |
| `tiles.html` | **Panel** | A control center of live tiles | Grid of glanceable, expandable tiles (Media, Volume, Brightness, System, Timer) each showing live state; tap expands in-place. Extensible (teases a future "Browser tabs" tile). IBM Plex family, precise utilitarian. |
| `console.html` | **Ledger** | A pro utility — fastest scan, zero chrome | Dense single column of full-bleed rows with inline sliders and tabular-numeral values, hairline dividers, restrained industrial elegance. Instrument Sans + tabular nums. |
| `dial.html` | **Dial** | One control you never look at | Central rotary wheel: drag around = volume, tap center = play/pause, flick left/right = prev/next; sleep timer winds the outer ring as a countdown arc. Minimal everything else. Bricolage Grotesque. |

## Feedback loop

Selector page (`index.html`) → user picks one + comments →
`POST /api/feedback` (Vercel function) → GitHub issue comment on
tejasnafde/macremote (agent polls) + Discord echo. Buttons: "Send feedback"
(iterate) and "Proceed with this design" (implementation greenlight).
