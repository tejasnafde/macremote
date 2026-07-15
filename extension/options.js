/**
 * Options page: stores {serverUrl, token} in chrome.storage.local (read by
 * background.js on every report/poll cycle) and offers a connection test
 * against GET /health followed by an authed POST /browser/report with an
 * empty tab list.
 */

const api = typeof browser !== "undefined" ? browser : chrome;

const urlInput = document.getElementById("server-url");
const tokenInput = document.getElementById("token");
const saveButton = document.getElementById("save");
const testButton = document.getElementById("test");
const statusEl = document.getElementById("status");

function detectBrowser() {
  return typeof browser !== "undefined" ? "firefox" : "chrome";
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = kind ? `status ${kind}` : "status";
}

function normalizedUrl() {
  return urlInput.value.trim().replace(/\/$/, "");
}

async function load() {
  const { serverUrl, token } = await api.storage.local.get(["serverUrl", "token"]);
  if (serverUrl) urlInput.value = serverUrl;
  if (token) tokenInput.value = token;
}

async function save() {
  const serverUrl = normalizedUrl();
  const token = tokenInput.value.trim();
  await api.storage.local.set({ serverUrl, token });
  setStatus("Saved.", "ok");
}

async function testConnection() {
  const serverUrl = normalizedUrl();
  const token = tokenInput.value.trim();

  if (!serverUrl || !token) {
    setStatus("Enter a server URL and token first.", "error");
    return;
  }

  setStatus("Testing...");

  try {
    const healthRes = await fetch(`${serverUrl}/health`);
    if (!healthRes.ok) {
      throw new Error(`health check returned ${healthRes.status}`);
    }

    const reportRes = await fetch(`${serverUrl}/browser/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ browser: detectBrowser(), tabs: [] }),
    });
    if (!reportRes.ok) {
      throw new Error(`token rejected (report returned ${reportRes.status})`);
    }

    setStatus("Connected. Server reachable and token accepted.", "ok");
  } catch (err) {
    setStatus(`Connection failed: ${err.message}`, "error");
  }
}

saveButton.addEventListener("click", save);
testButton.addEventListener("click", testConnection);
load();
