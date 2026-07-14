// Persisted client config: server URL + bearer token, plus small bits of
// app state (last self-update check timestamp) shared between the
// foreground app and the headless widget task handler.
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'macremote:serverUrl';
const TOKEN_KEY = 'macremote:token';
const LAST_UPDATE_CHECK_KEY = 'macremote:lastUpdateCheck';

export interface ServerConfig {
  serverUrl: string;
  token: string;
}

/** Strip a trailing slash so callers can always do `${serverUrl}${path}`. */
function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function getServerConfig(): Promise<ServerConfig> {
  const [serverUrl, token] = await Promise.all([
    AsyncStorage.getItem(SERVER_URL_KEY),
    AsyncStorage.getItem(TOKEN_KEY),
  ]);
  return { serverUrl: serverUrl ? normalizeUrl(serverUrl) : '', token: token ?? '' };
}

export async function setServerConfig(cfg: ServerConfig): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(SERVER_URL_KEY, normalizeUrl(cfg.serverUrl)),
    AsyncStorage.setItem(TOKEN_KEY, cfg.token.trim()),
  ]);
}

export async function hasServerConfig(): Promise<boolean> {
  const { serverUrl, token } = await getServerConfig();
  return serverUrl.length > 0 && token.length > 0;
}

export async function getLastUpdateCheck(): Promise<number> {
  const raw = await AsyncStorage.getItem(LAST_UPDATE_CHECK_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

export async function setLastUpdateCheck(timestampMs: number): Promise<void> {
  await AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, String(timestampMs));
}
