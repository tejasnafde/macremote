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

export type SleepMode = 'sleep' | 'blackout';

export interface SleepTimerStatus {
  remaining_seconds: number;
  mode?: SleepMode | null;
}

export interface BrowserTab {
  tab_id: number;
  browser: 'firefox' | 'chrome';
  title: string;
  playing: boolean;
  audible: boolean;
  /** Media volume 0-100 when the extension reports it; absent/null on older servers. */
  volume?: number | null;
}

export type BrowserTabAction = 'playpause' | 'focus' | 'mute' | 'seek' | 'setvolume';

export interface StatusResponse {
  now_playing: NowPlaying | null;
  volume: number | null;
  muted: boolean;
  brightness: number | null;
  battery: number | null;
  /** null when no timer is armed */
  sleep_timer: SleepTimerStatus | null;
  /** Absent on servers older than the browser bridge; treat as empty. */
  browser_tabs?: BrowserTab[];
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
  /** Software gamma dim level when the server is dimming this display without DDC. */
  gamma_level?: number | null;
}

export interface DisplaysResponse {
  displays: Display[];
}

export interface BrightnessResult {
  ok: boolean;
  /** true when an external monitor ignored the DDC command (unsupported, not an error). */
  display_unsupported?: boolean;
  /** How the change landed: real DDC backlight control or software gamma dimming. */
  via?: 'ddc' | 'gamma';
}

/** Navigation keys the server's /input/key endpoint accepts (422 on anything else). */
export type NavKey =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'pageup'
  | 'pagedown'
  | 'space'
  | 'home'
  | 'end';

export interface AppEntry {
  name: string;
  bundle_id: string;
  /** true for the frontmost app; the list is returned frontmost first. */
  active: boolean;
}

export interface AppsResponse {
  apps: AppEntry[];
}

export interface WindowEntry {
  id: number;
  app: string;
  bundle_id: string;
  title: string;
  /** true for the focused window; the active window is listed first on its display. */
  active: boolean;
}

export interface DisplayWindows {
  name: string;
  id: number;
  windows: WindowEntry[];
}

export interface WindowsResponse {
  /** Active display first, active window first within it. */
  displays: DisplayWindows[];
}

export interface FocusWindowResult {
  ok: boolean;
  /** true when the window closed between listing and focusing (not an error). */
  gone?: boolean;
}

export interface AudioApp {
  name: string;
  /** 0-100 via the Background Music driver. */
  volume: number;
}

export interface AudioAppsResponse {
  /** false when the Background Music driver is not installed; hide the feature. */
  available: boolean;
  apps: AudioApp[];
}

export interface SetAppVolumeResult {
  ok: boolean;
  /** false when the driver disappeared between list and set. */
  available?: boolean;
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

  /** display is a /displays id ("builtin" or an external index); omit for classic single-display behavior.
   *  Resolves to {ok:false, display_unsupported:true} when an external monitor ignores DDC (not an error). */
  brightnessUp: (display?: string): Promise<BrightnessResult> =>
    request(`/brightness/up${display ? `?display=${encodeURIComponent(display)}` : ''}`, { method: 'POST' }),
  brightnessDown: (display?: string): Promise<BrightnessResult> =>
    request(`/brightness/down${display ? `?display=${encodeURIComponent(display)}` : ''}`, { method: 'POST' }),

  displays: (): Promise<DisplaysResponse> => request<DisplaysResponse>('/displays'),

  lock: (): Promise<void> => request('/system/lock', { method: 'POST' }),
  sleep: (): Promise<void> => request('/system/sleep', { method: 'POST' }),
  /** Volume 0 + brightness 0 on every display; the Mac stays awake. */
  blackout: (): Promise<void> => request('/system/blackout', { method: 'POST' }),
  /** Undo blackout: restore volume and brightness to pre-blackout levels. */
  screensOn: (): Promise<void> => request('/system/screens-on', { method: 'POST' }),
  /** Parks the Mac's pointer in the screen corner (stuck-cursor-over-fullscreen-video fix). */
  banishCursor: (): Promise<void> => request('/system/banish-cursor', { method: 'POST' }),

  setSleepTimer: (minutes: number, mode: SleepMode = 'sleep'): Promise<void> =>
    request('/sleep-timer', { method: 'POST', body: JSON.stringify({ minutes, mode }) }),
  cancelSleepTimer: (): Promise<void> => request('/sleep-timer', { method: 'DELETE' }),

  /** Fire-and-forget: the extension executes it within ~2s of its next poll.
   *  `value` carries the seek delta in seconds when action is "seek", or the
   *  target volume 0-100 when action is "setvolume". */
  tabCommand: (tabId: number, browser: string, action: BrowserTabAction, value?: number): Promise<void> =>
    request(`/browser/tabs/${tabId}/command`, {
      method: 'POST',
      body: JSON.stringify({ action, browser, ...(value !== undefined ? { value } : {}) }),
    }),

  /** Scroll the frontmost Mac app by a pixel delta (server clamps each axis to -4000..4000). */
  inputScroll: (dx: number, dy: number): Promise<void> =>
    request('/input/scroll', { method: 'POST', body: JSON.stringify({ dx: Math.round(dx), dy: Math.round(dy) }) }),
  /** Send a single navigation key to the frontmost app (422 if not in the allowed set). */
  inputKey: (key: NavKey): Promise<void> =>
    request('/input/key', { method: 'POST', body: JSON.stringify({ key }) }),

  /** Running apps, frontmost first (active:true on the frontmost). */
  listApps: (): Promise<AppsResponse> => request<AppsResponse>('/apps'),
  /** Raise the app with this bundle id to the front. */
  focusApp: (bundleId: string): Promise<void> =>
    request('/apps/focus', { method: 'POST', body: JSON.stringify({ bundle_id: bundleId }) }),

  /** Windows grouped by display, active display and active window first.
   *  404 on servers older than v0.4 (callers fall back to listApps). */
  listWindows: (): Promise<WindowsResponse> => request<WindowsResponse>('/windows'),
  /** Raise a specific window. Resolves {ok:false, gone:true} when it closed since listing. */
  focusWindow: (windowId: number): Promise<FocusWindowResult> =>
    request(`/windows/${windowId}/focus`, { method: 'POST' }),

  /** Per-app volumes via the Background Music driver; available:false when not installed. */
  listAudioApps: (): Promise<AudioAppsResponse> => request<AudioAppsResponse>('/audio/apps'),
  setAppVolume: (name: string, volume: number): Promise<SetAppVolumeResult> =>
    request('/audio/apps', {
      method: 'PUT',
      body: JSON.stringify({ name, volume: Math.max(0, Math.min(100, Math.round(volume))) }),
    }),

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
