// The bridge "died" when one report threw or hung: the next alarm was only
// scheduled after the report, so the chain ended. Load the real background.js
// with a fake extension API and check that the chain survives both failures.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
console.error = () => {};

const src = readFileSync(new URL("./background.js", import.meta.url), "utf8")
  .replace("const REPORT_TIMEOUT_MS = 15000;", "const REPORT_TIMEOUT_MS = 50;");

function load(fetchImpl) {
  const created = [];
  let onAlarm;
  const fake = {
    alarms: {
      create: (name) => created.push(name),
      get: async () => undefined,
      onAlarm: { addListener: (fn) => (onAlarm = fn) },
    },
    runtime: { getManifest: () => ({ version: "test" }), onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    storage: { local: { get: async () => ({ serverUrl: "http://mac", token: "t" }), set: async () => {} } },
    tabs: { query: async () => [], get: async () => { throw new Error("gone"); } },
  };
  new Function("browser", "fetch", src)(fake, fetchImpl);
  created.length = 0;
  return { created, fire: (name) => onAlarm({ name }) };
}

for (const [label, fetchImpl] of [
  ["throws", async () => { throw new Error("network down"); }],
  ["hangs", () => new Promise(() => {})],
]) {
  const bridge = load(fetchImpl);
  bridge.fire("macremote-report");
  bridge.fire("macremote-poll");
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(bridge.created.includes("macremote-report"), `report alarm rescheduled when fetch ${label}`);
  assert.ok(bridge.created.includes("macremote-poll"), `poll alarm rescheduled when fetch ${label}`);
}
console.log("loop.test ok");
