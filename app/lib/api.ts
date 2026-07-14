// Typed client for the macremote FastAPI server (see
// docs/plans/2026-07-15-macremote-design.md for the API surface). Base URL
// and bearer token come from AsyncStorage (see lib/storage.ts) so both the
// foreground app and the headless widget task handler can share them.
import { getServerConfig } from './storage';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { serverUrl, token } = await getServerConfig();
  if (!serverUrl) {
    throw new ApiError('Server URL is not configured', 'not-configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${serverUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new ApiError(`HTTP ${res.status} on ${path}`, 'http', res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  playPause: (): Promise<void> => request('/media/playpause', { method: 'POST' }),
  next: (): Promise<void> => request('/media/next', { method: 'POST' }),
  previous: (): Promise<void> => request('/media/previous', { method: 'POST' }),

  volumeUp: (): Promise<void> => request('/volume/up', { method: 'POST' }),
  volumeDown: (): Promise<void> => request('/volume/down', { method: 'POST' }),
  volumeMute: (): Promise<void> => request('/volume/mute', { method: 'POST' }),
  setVolume: (level: number): Promise<void> =>
    request('/volume', { method: 'PUT', body: JSON.stringify({ level }) }),

  brightnessUp: (): Promise<void> => request('/brightness/up', { method: 'POST' }),
  brightnessDown: (): Promise<void> => request('/brightness/down', { method: 'POST' }),

  lock: (): Promise<void> => request('/system/lock', { method: 'POST' }),
  sleep: (): Promise<void> => request('/system/sleep', { method: 'POST' }),

  setSleepTimer: (minutes: number): Promise<void> =>
    request('/sleep-timer', { method: 'POST', body: JSON.stringify({ minutes }) }),
  cancelSleepTimer: (): Promise<void> => request('/sleep-timer', { method: 'DELETE' }),

  status: (): Promise<StatusResponse> => request<StatusResponse>('/status'),
  health: (): Promise<HealthResponse> => request<HealthResponse>('/health'),
  version: (): Promise<VersionResponse> => request<VersionResponse>('/version'),
};
