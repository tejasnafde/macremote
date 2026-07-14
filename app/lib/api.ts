// Typed client for the macremote FastAPI server (see
// docs/plans/2026-07-15-macremote-design.md for the API surface). Base URL
// and bearer token come from the ACTIVE device (see lib/devices.ts) so both
// the foreground app and the headless widget task handler always drive
// whichever Mac the user last switched to.
import { getActiveDevice, normalizeServerUrl } from './devices';

const TIMEOUT_MS = 4000;

export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: 'not-configured' | 'timeout' | 'network' | 'http';

  constructor(message: string, kind: ApiError['kind'], status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export interface NowPlaying {
  title: string | null;
  artist: string | null;
  app: string | null;
  /** e.g. "kPlaybackStatePlaying" | "playing" | "paused" (Hammerspoon spotify/itunes state) */
  state?: string | null;
}

export interface SleepTimerStatus {
  remaining_seconds: number;
}

export interface StatusResponse {
  now_playing: NowPlaying | null;
  volume: number | null;
  muted: boolean;
  brightness: number | null;
  battery: number | null;
  /** null when no timer is armed */
  sleep_timer: SleepTimerStatus | null;
}

export interface HealthResponse {
  status: string;
}

export interface VersionResponse {
  version: string;
}

export interface SeekResponse {
  ok: boolean;
  /** Which mechanism handled the seek: exact for spotify/music, arrow-key fallback otherwise. */
  via: 'spotify' | 'music' | 'keys' | 'noop';
}

export interface Display {
  id: string;
  name: string;
  builtin: boolean;
  /** null when the display doesn't report brightness (probe failed or unsupported). */
  brightness: number | null;
}

export interface DisplaysResponse {
  displays: Display[];
}

async function requestWithConfig<T>(
  cfg: { url: string; token: string },
  path: string,
  init?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${cfg.url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError(`${init?.method ?? 'GET'} ${path} timed out`, 'timeout');
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed',
      'network'
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      const hint = cfg.token
        ? `API token rejected by the server (sent ${cfg.token.length} chars). Re-paste it from your server/.env, no backticks or spaces.`
        : 'No API token saved. Paste it in the device setup screen and save.';
      throw new ApiError(hint, 'http', res.status);
    }
    throw new ApiError(`HTTP ${res.status} on ${path}`, 'http', res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const device = await getActiveDevice();
  if (!device) {
    throw new ApiError('No device is set up yet', 'not-configured');
  }
  return requestWithConfig<T>({ url: device.url, token: device.token }, path, init);
}

export const api = {
  playPause: (): Promise<void> => request('/media/playpause', { method: 'POST' }),
  next: (): Promise<void> => request('/media/next', { method: 'POST' }),
  previous: (): Promise<void> => request('/media/previous', { method: 'POST' }),
  /** seconds is clamped -60..60 by the server; negative rewinds, positive skips ahead. */
  seek: (seconds: number): Promise<SeekResponse> =>
    request('/media/seek', { method: 'POST', body: JSON.stringify({ seconds }) }),

  volumeUp: (): Promise<void> => request('/volume/up', { method: 'POST' }),
  volumeDown: (): Promise<void> => request('/volume/down', { method: 'POST' }),
  volumeMute: (): Promise<void> => request('/volume/mute', { method: 'POST' }),
  setVolume: (level: number): Promise<void> =>
    request('/volume', { method: 'PUT', body: JSON.stringify({ level }) }),

  /** display is a /displays id ("builtin" or an external index); omit for classic single-display behavior. */
  brightnessUp: (display?: string): Promise<void> =>
    request(`/brightness/up${display ? `?display=${encodeURIComponent(display)}` : ''}`, { method: 'POST' }),
  brightnessDown: (display?: string): Promise<void> =>
    request(`/brightness/down${display ? `?display=${encodeURIComponent(display)}` : ''}`, { method: 'POST' }),

  displays: (): Promise<DisplaysResponse> => request<DisplaysResponse>('/displays'),

  lock: (): Promise<void> => request('/system/lock', { method: 'POST' }),
  sleep: (): Promise<void> => request('/system/sleep', { method: 'POST' }),
  /** Parks the Mac's pointer in the screen corner (stuck-cursor-over-fullscreen-video fix). */
  banishCursor: (): Promise<void> => request('/system/banish-cursor', { method: 'POST' }),

  setSleepTimer: (minutes: number): Promise<void> =>
    request('/sleep-timer', { method: 'POST', body: JSON.stringify({ minutes }) }),
  cancelSleepTimer: (): Promise<void> => request('/sleep-timer', { method: 'DELETE' }),

  status: (): Promise<StatusResponse> => request<StatusResponse>('/status'),
  health: (): Promise<HealthResponse> => request<HealthResponse>('/health'),
  version: (): Promise<VersionResponse> => request<VersionResponse>('/version'),
};

/**
 * Probe an as-yet-unsaved url/token pair (Setup screen's "Test Connection").
 * Bypasses the active-device lookup entirely so it works before the device
 * is added to storage.
 */
export async function testConnection(url: string, token: string): Promise<void> {
  const cfg = { url: normalizeServerUrl(url), token: token.trim() };
  await requestWithConfig<HealthResponse>(cfg, '/health');
  await requestWithConfig<StatusResponse>(cfg, '/status');
}
