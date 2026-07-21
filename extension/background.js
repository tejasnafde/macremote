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

  // Carry over any tab we have seen play, for as long as it stays OPEN (not on
  // a timer): a video you paused to listen to music might sit paused for an
  // hour, and you still want to resume it from the phone. It drops out only
  // when the tab is actually closed (tabs.get throws). Quiet tabs report as
  // paused (playing:false, audible:false) so the phone shows the right icon.
  for (const [tabIdKey, entry] of Object.entries(known)) {
    if (nextKnown[tabIdKey]) continue;
    try {
      const tab = await api.tabs.get(Number(tabIdKey));
      nextKnown[tabIdKey] = {
        ...entry,
        title: tab.title || entry.title,
        urlHost: hostFromUrl(tab.url) || entry.urlHost,
        audible: false,
        playing: false,
      };
    } catch (err) {
      // Tab was closed - let it drop out of the known set.
    }
  }

  await setKnownTabs(nextKnown);

  // Best-effort per-tab media volume (0-100 int, null when unreadable): the
  // known set is small (only media tabs), so one cheap injection per tab per
  // report keeps the phone's volume sliders in sync.
  const volumes = {};
  for (const tabIdKey of Object.keys(nextKnown)) {
    volumes[tabIdKey] = await readTabVolume(Number(tabIdKey));
  }

  const tabs = Object.entries(nextKnown).map(([tabIdKey, t]) => ({
    tab_id: t.tabId,
    title: t.title,
    url_host: t.urlHost,
    audible: t.audible,
    muted: t.muted,
    playing: t.playing,
    volume: volumes[tabIdKey],
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

/**
 * Reads the volume (0-100 int) of the tab's relevant media element: the
 * playing one, else the largest by finite duration. Returns null whenever
 * that is not cheaply possible (no media, restricted page, injection denied).
 */
async function readTabVolume(tabId) {
  try {
    const results = await api.scripting.executeScript({
      target: { tabId },
      func: () => {
        const media = Array.from(document.querySelectorAll("video, audio")).filter(
          (el) => Number.isFinite(el.duration) && el.duration > 0
        );
        if (media.length === 0) return null;
        const el = media.find((m) => !m.paused) || media.reduce((a, b) => (b.duration > a.duration ? b : a));
        return Math.round((el.volume || 0) * 100);
      },
    });
    const value = results && results[0] ? results[0].result : null;
    return typeof value === "number" ? value : null;
  } catch (err) {
    return null;
  }
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

async function seekTab(tabId, seconds) {
  const delta = Number(seconds) || 0;
  if (!delta) return;
  try {
    await api.scripting.executeScript({
      target: { tabId },
      args: [delta],
      func: (d) => {
        // Only consider real, seekable media with a finite duration. YouTube /
        // YT Music often have extra <video> elements (ads, previews) with NaN
        // duration; picking one of those made currentTime a NaN no-op before.
        const media = Array.from(document.querySelectorAll("video, audio")).filter(
          (el) => Number.isFinite(el.duration) && el.duration > 0
        );
        if (media.length === 0) return;
        const el = media.find((m) => !m.paused) || media.reduce((a, b) => (b.duration > a.duration ? b : a));
        const t = Math.max(0, Math.min(el.duration, (el.currentTime || 0) + d));
        try {
          if (typeof el.fastSeek === "function") el.fastSeek(t);
          else el.currentTime = t;
        } catch (e) {
          el.currentTime = t;
        }
      },
    });
  } catch (err) {
    console.error("macremote: seek injection failed", err);
  }
}

/**
 * Sets the tab's media element volume (value is 0-100). Targets the playing
 * element, else the largest finite-duration one - same selection as seek.
 * Deliberately does NOT touch `muted`, even at 0: mute stays its own command,
 * so volume 0 and mute remain independently reversible from the phone.
 */
async function setTabVolume(tabId, value) {
  const level = Math.max(0, Math.min(100, Number(value) || 0));
  try {
    await api.scripting.executeScript({
      target: { tabId },
      args: [level],
      func: (v) => {
        const media = Array.from(document.querySelectorAll("video, audio")).filter(
          (el) => Number.isFinite(el.duration) && el.duration > 0
        );
        if (media.length === 0) return;
        const el = media.find((m) => !m.paused) || media.reduce((a, b) => (b.duration > a.duration ? b : a));
        el.volume = v / 100;
      },
    });
  } catch (err) {
    console.error("macremote: setvolume injection failed", err);
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
  } else if (command.action === "seek") {
    await seekTab(tabId, Number(command.value) || 0);
  } else if (command.action === "setvolume") {
    await setTabVolume(tabId, Number(command.value) || 0);
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
