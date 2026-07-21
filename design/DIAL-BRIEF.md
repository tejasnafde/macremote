# Brightness dial mockups (round 1)

User request: replace the bottom brightness up/down buttons with a circular
DIAL, and tapping the dial reveals which screen(s) it targets (the user has a
built-in display + external monitors, any permutation). Mock UIs first, then
implement the chosen one.

Context: macremote Deck aesthetic. Dark ink #0B0E12 base, off-white text,
green accent #4ADE80, Familjen Grotesk (UI) + Archivo Black (numerals) via
Google Fonts. No emojis, no em dashes. SVG only, no icon fonts.

Real data shape the dial drives (already live in the server):
- Displays: [{id, name, builtin, brightness|null, gamma_level, method}]. There
  can be 1..N displays. Brightness is 0-100 (gamma_level when software-dimmed).
- Setting brightness is per display.

Build 3 self-contained HTML mockups in design/mockups/, phone-sized, dark,
each with REAL working drag on the dial (pointer events + atan2), and a
believable screen-selection interaction. Fake 3 displays for the demo:
"Built-in" 70, "BenQ EX2710S" 45, "LG UltraGear" 100.

Directions:
1. dial-radial.html — one big rotary dial. Drag the ring = brightness of the
   ACTIVE display; big % in the center; tap the center to bloom a ring of
   screen chips around the dial, pick one to make it active (dial animates to
   its level). Active screen name under the %.
2. dial-arc.html — a ~250 degree arc gauge (not full circle), drag the head to
   set; a slim segmented screen selector sits just above the dial (Built-in |
   BenQ | LG), tapping a segment retargets the dial with a smooth sweep. Reads
   more like an instrument.
3. dial-stack.html — no selection step: one compact dial PER screen shown
   together (a row/grid of small dials, each labelled + independently
   draggable), so all displays are controllable at a glance. Scales if there
   are 3+ screens.

Each mockup: fixed phone viewport, no scroll (stack may scroll if >3), tactile
press/drag feedback, a header label "Brightness", and enough surrounding Deck
chrome (a faint status strip) that it reads as part of the app, not a floating
widget. Include a tiny note when a display is software-dimmed (gamma) vs
hardware, since that is real.

Deploy: these get added to the existing design/ Vercel site; index.html becomes
a 3-way selector reusing the feedback POST (/api/feedback) so the user can pick
+ comment from the phone.
