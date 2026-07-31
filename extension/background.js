/**
 * macremote Browser Bridge - background script (MV3).
 *
 * One codebase for Chrome and Firefox: `browser.*` is promise-based on
 * Firefox, and Chrome has returned promises from these same APIs (when no
 * callback is passed) since Manifest V3, so a single `api` alias plus
 * async/await works unmodified on both.
 *
 * Loop, driven by chrome.alarms (survives service worker eviction - each
 * alarm fire wakes this script back up):
 *   - every 5s: collect audible tabs + any tab we have seen play that is still
 *     open (so a paused tab stays controllable until its tab is closed),
 *     report the full list to the server.
 *   - poll /browser/commands every 2s while we know about at least one
 *     media tab, otherwise every 15s (idle, nothing to control).
 *   - after executing any command, report again immediately so the phone gets
 *     real state within ~1s instead of waiting out the 5s report interval.
 *
 * Note: Chrome clamps alarm periods to a 1-minute minimum for extensions
 * installed from the Chrome Web Store. That clamp does not apply to
 * extensions loaded unpacked in developer mode, which is how this bridge is
 * meant to be run (see README.md) - so the 5s/2s cadences above hold.
 */

const api = typeof browser !== "undefined" ? browser : chrome;
const BROWSER_NAME = typeof browser !== "undefined" ? "firefox" : "chrome";

const REPORT_ALARM = "macremote-report";
const POLL_ALARM = "macremote-poll";
const REPORT_INTERVAL_SECONDS = 5;
const POLL_INTERVAL_ACTIVE_SECONDS = 2;
const POLL_INTERVAL_IDLE_SECONDS = 15;
const KNOWN_TABS_KEY = "macremoteKnownTabs";

function hostFromUrl(url) {
  try {
    return new URL(url).host;
  } catch (err) {
    return "";
  }
}

async function getConfig() {
  const { serverUrl, token } = await api.storage.local.get(["serverUrl", "token"]);
  return { serverUrl: serverUrl || "", token: token || "" };
}

async function getKnownTabs() {
  const stored = await api.storage.local.get(KNOWN_TABS_KEY);
  return stored[KNOWN_TABS_KEY] || {};
}

async function setKnownTabs(map) {
  await api.storage.local.set({ [KNOWN_TABS_KEY]: map });
}

function serverFetch(config, path, options) {
  const base = config.serverUrl.replace(/\/$/, "");
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options && options.headers),
      Authorization: `Bearer ${config.token}`,
    },
  });
}

function tabEntry(tab, lastSeenAt) {
  return {
    tabId: tab.id,
    title: tab.title || "",
    urlHost: hostFromUrl(tab.url),
    audible: Boolean(tab.audible),
    muted: Boolean(tab.mutedInfo && tab.mutedInfo.muted),
    active: Boolean(tab.active),
    discarded: Boolean(tab.discarded),
    lastSeenAt,
  };
}

/**
 * Collects audible tabs plus recently-known media tabs, persists the merged
 * set, and reports it to the server. Returns the number of tabs reported so
 * the caller can decide the next poll cadence.
 */
async function collectAndReport() {
  const config = await getConfig();
  if (!config.serverUrl || !config.token) return 0;

  const now = Date.now();
  const known = await getKnownTabs();

  let audibleTabs = [];
  try {
    audibleTabs = await api.tabs.query({ audible: true });
  } catch (err) {
    console.error("macremote: tabs.query({audible:true}) failed", err);
  }

  const nextKnown = {};

  for (const tab of audibleTabs) {
    nextKnown[tab.id] = tabEntry(tab, now);
  }

  // Carry over any tab we have seen play, for as long as it stays OPEN (not on
  // a timer): a video you paused to listen to music might sit paused for an
  // hour, and you still want to resume it from the phone. It drops out only
  // when the tab is actually closed (tabs.get throws). Re-read from the live
  // tab every time so title/muted/active never go stale.
  for (const tabIdKey of Object.keys(known)) {
    if (nextKnown[tabIdKey]) continue;
    try {
      const tab = await api.tabs.get(Number(tabIdKey));
      nextKnown[tabIdKey] = tabEntry(tab, known[tabIdKey].lastSeenAt || now);
    } catch (err) {
      // Tab was closed - let it drop out of the known set.
    }
  }

  await setKnownTabs(nextKnown);

  // One injection per known media tab gives real element state. `audible` is
  // only a discovery hint: a muted or silent video is still playing, and
  // inferring `playing` from it inverted the phone's play/pause icon.
  const ids = Object.keys(nextKnown).map(Number);
  const probes = await Promise.all(
    ids.map((id) => (nextKnown[id].discarded ? Promise.resolve(null) : probeTab(id)))
  );

  const tabs = ids.map((id, i) => {
    const t = nextKnown[id];
    const p = probes[i];
    return {
      tab_id: t.tabId,
      title: t.title,
      url_host: t.urlHost,
      audible: t.audible,
      muted: t.muted,
      playing: p ? !p.paused : t.audible,
      volume: p ? p.volume : null,
      active: t.active,
      fullscreen: p ? p.fullscreen : false,
    };
  });

  try {
    await serverFetch(config, "/browser/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser: BROWSER_NAME, tabs }),
    });
  } catch (err) {
    console.error("macremote: /browser/report failed", err);
  }

  return tabs.length;
}

/**
 * The ONE function injected into pages. Every media command and the state probe
 * goes through it, so they can never disagree about which element is "the"
 * player - seek used to filter by duration while playpause picked by area, and
 * the two then acted on different elements.
 *
 * Only real seekable media counts: YouTube keeps extra <video> elements (ads,
 * previews) with a NaN duration, and picking one made commands silent no-ops.
 * Returns null when the page has no such element.
 */
function mediaOp(op, arg) {
  const media = Array.from(document.querySelectorAll("video, audio")).filter(
    (el) => Number.isFinite(el.duration) && el.duration > 0
  );
  if (media.length === 0) return null;
  const el = media.find((m) => !m.paused) || media.reduce((a, b) => (b.duration > a.duration ? b : a));

  if (op === "probe") {
    return {
      paused: el.paused,
      volume: Math.round((el.volume || 0) * 100),
      fullscreen: document.fullscreenElement != null,
    };
  }
  if (op === "seek") {
    const t = Math.max(0, Math.min(el.duration, (el.currentTime || 0) + arg));
    try {
      if (typeof el.fastSeek === "function") el.fastSeek(t);
      else el.currentTime = t;
    } catch (e) {
      el.currentTime = t;
    }
    return true;
  }
  // Deliberately does NOT touch `muted`, even at 0: mute stays its own command,
  // so volume 0 and mute remain independently reversible from the phone.
  if (op === "setvolume") {
    el.volume = arg / 100;
    return true;
  }
  // "play" | "pause" | "toggle"
  const want = op === "toggle" ? el.paused : op === "play";
  if (!want) {
    el.pause();
    return true;
  }
  // play() rejects when the autoplay policy blocks a scripted start.
  return Promise.resolve(el.play()).then(
    () => true,
    () => false
  );
}

/** Runs mediaOp in a tab. Returns its result, or null if injection failed. */
async function runMediaOp(tabId, op, arg = null) {
  try {
    const results = await api.scripting.executeScript({
      target: { tabId },
      args: [op, arg],
      func: mediaOp,
    });
    return results && results[0] ? results[0].result : null;
  } catch (err) {
    return null;
  }
}

/** {paused, volume 0-100, fullscreen}, or null when unreadable. */
function probeTab(tabId) {
  return runMediaOp(tabId, "probe");
}

async function focusTab(tabId) {
  try {
    const tab = await api.tabs.update(tabId, { active: true });
    if (tab && tab.windowId != null) {
      await api.windows.update(tab.windowId, { focused: true });
    }
    // Drop focus from any text field, so a hotkey the Mac sends next (the "f"
    // of the fullscreen flow) reaches the player instead of being typed.
    await api.scripting
      .executeScript({
        target: { tabId },
        func: () => {
          const a = document.activeElement;
          if (a && a !== document.body && typeof a.blur === "function") a.blur();
        },
      })
      .catch(() => undefined);
  } catch (err) {
    console.error("macremote: focus failed", err);
  }
}

async function toggleMute(tabId) {
  try {
    const tab = await api.tabs.get(tabId);
    const muted = Boolean(tab.mutedInfo && tab.mutedInfo.muted);
    await api.tabs.update(tabId, { muted: !muted });
  } catch (err) {
    console.error("macremote: mute toggle failed", err);
  }
}

async function executeCommand(command) {
  const tabId = command.tab_id;
  const action = command.action;
  if (action === "play" || action === "pause") {
    await runMediaOp(tabId, action);
  } else if (action === "playpause") {
    await runMediaOp(tabId, "toggle");
  } else if (action === "focus") {
    await focusTab(tabId);
  } else if (action === "mute") {
    await toggleMute(tabId);
  } else if (action === "seek") {
    const delta = Number(command.value) || 0;
    if (delta) await runMediaOp(tabId, "seek", delta);
  } else if (action === "setvolume") {
    await runMediaOp(tabId, "setvolume", Math.max(0, Math.min(100, Number(command.value) || 0)));
  } else {
    console.warn("macremote: unknown command action", action);
  }
}

async function pollCommands() {
  const config = await getConfig();
  if (!config.serverUrl || !config.token) return;

  try {
    const res = await serverFetch(config, `/browser/commands?browser=${BROWSER_NAME}`, {
      method: "GET",
    });
    if (!res.ok) return;
    const body = await res.json();
    const commands = body.commands || [];
    for (const command of commands) {
      await executeCommand(command);
    }
    // Report straight away instead of waiting out the 5s interval: the phone
    // drew an optimistic icon on tap and needs real state to confirm it, and
    // the fullscreen flow waits on this report to know the tab switched.
    if (commands.length > 0) await collectAndReport();
  } catch (err) {
    console.error("macremote: /browser/commands poll failed", err);
  }
}

function scheduleAlarm(name, seconds) {
  api.alarms.create(name, { delayInMinutes: seconds / 60 });
}

async function handleReportAlarm() {
  const tabCount = await collectAndReport();
  scheduleAlarm(REPORT_ALARM, REPORT_INTERVAL_SECONDS);
  scheduleAlarm(POLL_ALARM, tabCount > 0 ? POLL_INTERVAL_ACTIVE_SECONDS : POLL_INTERVAL_IDLE_SECONDS);
}

async function handlePollAlarm() {
  await pollCommands();
  const known = await getKnownTabs();
  const hasMediaTabs = Object.keys(known).length > 0;
  scheduleAlarm(POLL_ALARM, hasMediaTabs ? POLL_INTERVAL_ACTIVE_SECONDS : POLL_INTERVAL_IDLE_SECONDS);
}

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REPORT_ALARM) {
    handleReportAlarm();
  } else if (alarm.name === POLL_ALARM) {
    handlePollAlarm();
  }
});

function start() {
  scheduleAlarm(REPORT_ALARM, REPORT_INTERVAL_SECONDS);
  scheduleAlarm(POLL_ALARM, POLL_INTERVAL_IDLE_SECONDS);
}

api.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    api.runtime.openOptionsPage();
  }
  start();
});

api.runtime.onStartup.addListener(start);

// Covers the case where the service worker is (re)spawned by an alarm/message
// rather than a fresh onInstalled/onStartup event - alarms.create is
// idempotent per name, so this never double-schedules.
start();
