// APK self-update glue: check GitHub Releases for a newer build than the
// app's own version, download the asset, and hand off to the Android package
// installer. Pure version-compare logic lives in updater.ts.
// Adapted from scout/app/lib/apk.ts; here the "backend" is the public GitHub
// Releases API instead of our own server (no auth required, works before the
// server URL/token are even configured).
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { getLastUpdateCheck, setLastUpdateCheck } from './storage';
import { isNewer } from './updater';

const RELEASES_URL = 'https://api.github.com/repos/tejasnafde/macremote/releases/latest';
const CHECK_THROTTLE_MS = 24 * 60 * 60 * 1000; // once a day for automatic checks
const FETCH_TIMEOUT_MS = 8000;

export interface LatestRelease {
  version: string;
  apkUrl: string;
}

interface GithubAsset {
  name?: string;
  browser_download_url?: string;
}

interface GithubRelease {
  tag_name?: string;
  assets?: GithubAsset[];
}

async function fetchLatestRelease(): Promise<LatestRelease | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(RELEASES_URL, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as GithubRelease;
    const version = (json.tag_name ?? '').replace(/^v/, '');
    const asset = (json.assets ?? []).find((a) => (a.name ?? '').endsWith('.apk'));
    if (!version || !asset?.browser_download_url) return null;
    return { version, apkUrl: asset.browser_download_url };
  } catch {
    return null; // no release published yet, or offline: never block launch
  } finally {
    clearTimeout(timeout);
  }
}

/** The app's own version, from app.json (expo.version) via expo-constants. */
export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/**
 * Check GitHub Releases for a newer APK than the one running.
 * `force` bypasses the once-a-day throttle — used by the manual
 * "Check for update" button in Settings. Automatic launch checks respect it.
 */
export async function checkForUpdate(force = false): Promise<LatestRelease | null> {
  if (Platform.OS !== 'android') return null;
  if (!force) {
    const last = await getLastUpdateCheck();
    if (Date.now() - last < CHECK_THROTTLE_MS) return null;
  }
  await setLastUpdateCheck(Date.now());
  const latest = await fetchLatestRelease();
  if (!latest) return null;
  return isNewer(latest.version, currentVersion()) ? latest : null;
}

/** Download the release APK to cache and launch the system package installer. */
export async function downloadAndInstall(apkUrl: string): Promise<void> {
  const dest = `${FileSystem.cacheDirectory}macremote-update.apk`;
  const r = await FileSystem.downloadAsync(apkUrl, dest);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  const contentUri = await FileSystem.getContentUriAsync(r.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
