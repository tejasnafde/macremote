// Self-check for mediaOp, the one function injected into pages. Every tab
// command routes through it, so a mistake here breaks play, pause, seek and
// volume at once. Run: node extension/mediaOp.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// mediaOp is written to run inside a page, so it is loaded as source rather
// than imported: background.js is an extension service worker, not a module.
const src = readFileSync(new URL("./background.js", import.meta.url), "utf8");
const start = src.indexOf("function mediaOp(");
const end = src.indexOf("\n}", start) + 2;
assert.ok(start > 0, "mediaOp not found in background.js");
const body = src.slice(start, end);
// The slice ends at the first column-0 "}", so a stray unindented brace inside
// mediaOp would silently truncate what gets tested. Check every op is present.
for (const op of ["probe", "seek", "setvolume", "toggle"]) {
  assert.ok(body.includes(`"${op}"`), `extracted mediaOp is missing ${op}`);
}
const mediaOp = new Function(`${body}; return mediaOp;`)();

function el(props) {
  return {
    duration: 300,
    currentTime: 0,
    volume: 1,
    paused: true,
    played: false,
    pause() {
      this.paused = true;
    },
    play() {
      this.paused = false;
      this.played = true;
      return Promise.resolve();
    },
    ...props,
  };
}

// mediaOp remembers its last target on `window`, which in the extension is the
// isolated world's window, one per frame and per extension.
function withDom(elements, fullscreenElement = null) {
  globalThis.window = {};
  globalThis.document = {
    fullscreenElement,
    querySelectorAll: () => elements,
  };
}

// Ads and previews carry a NaN duration. Targeting one made every command a
// silent no-op, which is what made the phone's buttons look broken.
const ad = el({ duration: NaN, paused: false });
const real = el({ duration: 600, paused: true });
withDom([ad, real]);
assert.equal(mediaOp("probe").paused, true, "probe must skip the NaN-duration ad");
await mediaOp("play");
assert.equal(real.played, true, "play must target the real video");
assert.equal(ad.paused, false, "the ad must be left alone");

// A playing element wins over a longer paused one, so pause hits what you hear.
const long = el({ duration: 9000, paused: true });
const playing = el({ duration: 100, paused: false });
withDom([long, playing]);
mediaOp("pause");
assert.equal(playing.paused, true);
assert.equal(long.paused, true, "the paused long element must not be touched");

// Absolute modes ignore current state; toggle flips it.
const a = el({ paused: false });
withDom([a]);
mediaOp("pause");
assert.equal(a.paused, true);
mediaOp("pause");
assert.equal(a.paused, true, "pause must be idempotent, not a toggle");
await mediaOp("toggle");
assert.equal(a.paused, false, "toggle must flip");

// Seek clamps to [0, duration] and never writes NaN.
const s = el({ duration: 300, currentTime: 10, paused: false });
withDom([s]);
mediaOp("seek", -30);
assert.equal(s.currentTime, 0, "seek must clamp at 0");
mediaOp("seek", 1000);
assert.equal(s.currentTime, 300, "seek must clamp at duration");

// Volume is 0-100 on the wire, 0-1 on the element, and must not imply mute.
const v = el({ volume: 1, paused: false });
withDom([v]);
mediaOp("setvolume", 40);
assert.equal(v.volume, 0.4);
mediaOp("setvolume", 0);
assert.equal(v.volume, 0);
assert.equal(v.muted, undefined, "setvolume must not touch muted");

// Live streams report duration Infinity. Filtering on Number.isFinite locked
// every livestream out of play, pause, seek and volume at once.
const live = el({ duration: Infinity, paused: false });
withDom([live]);
assert.notEqual(mediaOp("probe"), null, "a live stream must be controllable");
mediaOp("pause");
assert.equal(live.paused, true);

// Pause then play must return to the SAME element. The target used to be
// "playing element, else longest", so pausing the short playing clip handed the
// next play to the long feature video and started the wrong thing.
const short = el({ duration: 30, paused: false });
const feature = el({ duration: 600, paused: true });
withDom([short, feature]);
mediaOp("pause");
assert.equal(short.paused, true);
await mediaOp("play");
assert.equal(short.played, true, "play must resume the element we paused");
assert.equal(feature.played, false, "the longer video must not start itself");

// ...but a video the user starts by hand still wins over the remembered one.
short.paused = true;
feature.paused = false;
mediaOp("pause");
assert.equal(feature.paused, true, "a manually started element takes over");

// A page with no usable media returns null instead of throwing.
withDom([el({ duration: NaN }), el({ duration: 0 })]);
assert.equal(mediaOp("probe"), null);
assert.equal(mediaOp("play"), null);

// A blocked play() resolves false rather than rejecting unhandled.
const blocked = el({ play: () => Promise.reject(new Error("autoplay")) });
withDom([blocked]);
assert.equal(await mediaOp("play"), false, "blocked play must report false");

// Fullscreen state comes from the document, not the element.
withDom([el({ paused: false })], {});
assert.equal(mediaOp("probe").fullscreen, true);

console.log("mediaOp: all checks passed");
