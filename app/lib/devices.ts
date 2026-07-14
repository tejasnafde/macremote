// Multi-device model: {devices: [{id, name, url, token}], activeId}. Replaces
// the single serverUrl/token pair in lib/storage.ts. On first read, if no
// devices exist yet but a legacy serverUrl/token pair does, it is migrated
// into devices[0] and made active — existing installs upgrade silently.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServerConfig as getLegacyServerConfig } from './storage';

export interface Device {
  id: string;
  name: string;
  url: string;
  token: string;
}

interface DevicesState {
  devices: Device[];
  activeId: string | null;
}

const DEVICES_KEY = 'macremote:devices';
const EMPTY_STATE: DevicesState = { devices: [], activeId: null };

/**
 * Accepts either a bare host:port ("192.168.1.42:5150", the mockup's setup
 * field placeholder) or a full "http://..."/"https://..." URL, and always
 * returns a fetch-ready URL with no trailing slash.
 */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/** Best-effort hostname for naming a freshly-migrated or freshly-added device. */
export function hostnameFromUrl(url: string): string {
  const trimmed = url.trim();
  try {
    // React Native's URL global covers this in modern Hermes; fall back to a
    // manual strip if it's ever unavailable for a malformed input.
    return new URL(/^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`).hostname;
  } catch {
    return trimmed.replace(/^https?:\/\//, '').split(/[/:]/)[0] || 'Mac';
  }
}

function makeId(): string {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function persist(state: DevicesState): Promise<void> {
  await AsyncStorage.setItem(DEVICES_KEY, JSON.stringify(state));
}

let migrationChecked = false;

async function migrateLegacyIfNeeded(state: DevicesState): Promise<DevicesState> {
  if (state.devices.length > 0 || migrationChecked) return state;
  migrationChecked = true;
  const legacy = await getLegacyServerConfig();
  if (!legacy.serverUrl || !legacy.token) return state;
  const device: Device = {
    id: makeId(),
    name: hostnameFromUrl(legacy.serverUrl),
    url: normalizeServerUrl(legacy.serverUrl),
    token: legacy.token.trim(),
  };
  const migrated: DevicesState = { devices: [device], activeId: device.id };
  await persist(migrated);
  return migrated;
}

async function read(): Promise<DevicesState> {
  const raw = await AsyncStorage.getItem(DEVICES_KEY);
  const parsed: DevicesState = raw ? JSON.parse(raw) : EMPTY_STATE;
  return migrateLegacyIfNeeded(parsed);
}

export async function getDevicesState(): Promise<DevicesState> {
  return read();
}

export async function getActiveDevice(): Promise<Device | null> {
  const state = await read();
  return state.devices.find((d) => d.id === state.activeId) ?? null;
}

export async function hasAnyDevice(): Promise<boolean> {
  const state = await read();
  return state.devices.length > 0;
}

export async function addDevice(input: { name?: string; url: string; token: string }): Promise<Device> {
  const state = await read();
  const device: Device = {
    id: makeId(),
    name: input.name?.trim() || hostnameFromUrl(input.url),
    url: normalizeServerUrl(input.url),
    token: input.token.trim(),
  };
  await persist({ devices: [...state.devices, device], activeId: device.id });
  return device;
}

export async function setActiveDevice(id: string): Promise<void> {
  const state = await read();
  if (!state.devices.some((d) => d.id === id)) return;
  await persist({ ...state, activeId: id });
}

export async function removeDevice(id: string): Promise<void> {
  const state = await read();
  const devices = state.devices.filter((d) => d.id !== id);
  const activeId = state.activeId === id ? (devices[0]?.id ?? null) : state.activeId;
  await persist({ devices, activeId });
}

export interface ProbeResult {
  online: boolean;
  version: string | null;
}

/** Short-timeout /health + /version probe used by the Devices screen's online dots. */
export async function probeDevice(device: Device, timeoutMs = 2500): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const healthRes = await fetch(`${device.url}/health`, { signal: controller.signal });
    if (!healthRes.ok) return { online: false, version: null };
    let version: string | null = null;
    try {
      const versionRes = await fetch(`${device.url}/version`, { signal: controller.signal });
      if (versionRes.ok) {
        const json = (await versionRes.json()) as { version?: string };
        version = json.version ?? null;
      }
    } catch {
      // health already confirmed the device is up; version is a bonus
    }
    return { online: true, version };
  } catch {
    return { online: false, version: null };
  } finally {
    clearTimeout(timer);
  }
}
