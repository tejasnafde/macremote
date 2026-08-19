import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./background.js", import.meta.url), "utf8");
const start = src.indexOf("function mergeCandidateTabs(");
const end = src.indexOf("\n}", start) + 2;
assert.ok(start > 0, "mergeCandidateTabs not found in background.js");
const body = src.slice(start, end);
const tabEntryStart = src.indexOf("function tabEntry(");
const tabEntryEnd = src.indexOf("\n}", tabEntryStart) + 2;
const tabEntryBody = src.slice(tabEntryStart, tabEntryEnd);
const hostStart = src.indexOf("function hostFromUrl(");
const hostEnd = src.indexOf("\n}", hostStart) + 2;
const hostBody = src.slice(hostStart, hostEnd);
const mergeCandidateTabs = new Function(
  `${hostBody}; ${tabEntryBody}; ${body}; return mergeCandidateTabs;`
)();

const queryStart = src.indexOf("async function queryCandidateTabs(");
const queryEnd = src.indexOf("\n}", queryStart) + 2;
assert.ok(queryStart > 0, "queryCandidateTabs not found in background.js");
const queryCandidateTabs = new Function(
  `${src.slice(queryStart, queryEnd)}; return queryCandidateTabs;`
)();
const shouldStart = src.indexOf("function shouldReportCandidate(");
const shouldEnd = src.indexOf("\n}", shouldStart) + 2;
assert.ok(shouldStart > 0, "shouldReportCandidate not found in background.js");
const shouldReportCandidate = new Function(
  `${src.slice(shouldStart, shouldEnd)}; return shouldReportCandidate;`
)();
const frameStart = src.indexOf("function nextFrameId(");
const frameEnd = src.indexOf("\n}", frameStart) + 2;
assert.ok(frameStart > 0, "nextFrameId not found in background.js");
const nextFrameId = new Function(
  `${src.slice(frameStart, frameEnd)}; return nextFrameId;`
)();

const tab = (id, props = {}) => ({
  id,
  title: `Tab ${id}`,
  url: `https://example${id}.com/watch`,
  audible: false,
  active: false,
  discarded: false,
  mutedInfo: { muted: false },
  ...props,
});

const candidates = mergeCandidateTabs(
  [tab(2, { audible: true })],
  [tab(1, { active: true })],
  { 3: { tabId: 3, title: "Known" } },
);

assert.equal(candidates[1].active, true, "an active silent tab must be probed");
assert.equal(candidates[2].audible, true, "an audible tab must be probed");
assert.equal(candidates[3].wasKnown, true, "a known media tab must remain a candidate");
assert.equal(candidates[3].keepWithoutProbe, true, "legacy known tabs came from audible discovery");

const duplicate = tab(4, { active: true, audible: true });
const deduplicated = mergeCandidateTabs([duplicate], [duplicate], {});
assert.deepEqual(Object.keys(deduplicated), ["4"]);

const originalConsoleError = console.error;
console.error = () => {};
const [audibleAfterActiveFailure, activeAfterFailure] = await queryCandidateTabs({
  query: ({ audible }) => audible ? Promise.resolve([tab(5, { audible: true })]) : Promise.reject(new Error("active failed")),
});
console.error = originalConsoleError;
assert.equal(audibleAfterActiveFailure[0].id, 5, "active query failure must not discard audible tabs");
assert.deepEqual(activeAfterFailure, []);

assert.equal(
  shouldReportCandidate({ audible: false, wasKnown: false, keepWithoutProbe: false }, { paused: true }),
  true,
  "an active paused media element must be reported",
);
assert.equal(
  shouldReportCandidate({ audible: false, wasKnown: true, keepWithoutProbe: false }, null),
  false,
  "a probe-only entry must drop after its media element disappears",
);
assert.equal(
  shouldReportCandidate({ audible: false, wasKnown: true, keepWithoutProbe: true }, null),
  true,
  "audible-discovered players remain available for MediaSession fallback",
);
assert.equal(nextFrameId(12, { result: null, frameId: null }), 12, "failed probe keeps the known frame");
assert.equal(nextFrameId(12, { result: { paused: false }, frameId: 7 }), 7, "successful probe refreshes the frame");

console.log("discovery: all checks passed");
