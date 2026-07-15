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
 *   - every 5s: collect audible tabs + any tab we last saw playing within
 *     the last 5 minutes (so a paused tab stays controllable), report the
 *     full list to the server.
 *   - poll /browser/commands every 2s while we know about at least one
 *     media tab, otherwise every 15s (idle, nothing to control).
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
const KNOWN_TAB_TTL_MS = 5 * 60 * 1000;
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
    nextKnown[tab.id] = {
      tabId: tab.id,
      title: tab.title || "",
      urlHost: hostFromUrl(tab.url),
      audible: true,
      muted: Boolean(tab.mutedInfo && tab.mutedInfo.muted),
      playing: true,
      lastSeenAt: now,
    };
  }

  // Carry over tabs we last saw playing (or muted-but-playing, which never
  // shows up as "audible") so they stay controllable for a while after they
  // go quiet, instead of vanishing from the phone the instant playback pauses.
  for (const [tabIdKey, entry] of Object.entries(known)) {
    if (nextKnown[tabIdKey]) continue;
    if (now - entry.lastSeenAt > KNOWN_TAB_TTL_MS) continue;
    try {
      const tab = await api.tabs.get(Number(tabIdKey));
      nextKnown[tabIdKey] = {
        ...entry,
        title: tab.title || entry.title,
        urlHost: hostFromUrl(tab.url) || entry.urlHost,
        audible: false,
      };
    } catch (err) {
      // Tab was closed - let it drop out of the known set.
    }
  }

  await setKnownTabs(nextKnown);

  const tabs = Object.values(nextKnown).map((t) => ({
    tab_id: t.tabId,
    title: t.title,
    url_host: t.urlHost,
    audible: t.audible,
    muted: t.muted,
    playing: t.playing,
  }));

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

async function togglePlayback(tabId) {
  try {
    await api.scripting.executeScript({
      target: { tabId },
      func: () => {
        const media = Array.from(document.querySelectorAll("video, audio"));
        if (media.length === 0) return;
        const currentlyPlaying = media.find((el) => !el.paused);
        const target =
          currentlyPlaying ||
          media.reduce((largest, el) => {
            const area = (el.videoWidth || el.clientWidth || 0) * (el.videoHeight || el.clientHeight || 0);
            const largestArea = (largest.videoWidth || largest.clientWidth || 0) * (largest.videoHeight || largest.clientHeight || 0);
            return area > largestArea ? el : largest;
          });
        if (target.paused) {
          target.play();
        } else {
          target.pause();
        }
      },
    });
  } catch (err) {
    console.error("macremote: playpause injection failed", err);
  }
}

async function focusTab(tabId) {
  try {
    const tab = await api.tabs.update(tabId, { active: true });
    if (tab && tab.windowId != null) {
      await api.windows.update(tab.windowId, { focused: true });
    }
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
  if (command.action === "playpause") {
    await togglePlayback(tabId);
  } else if (command.action === "focus") {
    await focusTab(tabId);
  } else if (command.action === "mute") {
    await toggleMute(tabId);
  } else {
    console.warn("macremote: unknown command action", command.action);
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
    for (const command of body.commands || []) {
      await executeCommand(command);
    }
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
