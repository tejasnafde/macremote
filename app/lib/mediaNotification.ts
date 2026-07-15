// Thin JS wrapper over the native MacRemoteMediaSession module (Kotlin, see
// app/modules/media-session). The native side owns the MediaSessionCompat and
// the foreground MediaStyle notification; JS only pushes now-playing metadata
// into it and reacts to button presses. All network work stays in JS: the
// foreground service keeps this JS context alive, so a notification button
// press arrives here as an "onMediaAction" event and we drive the server API
// from RemoteScreen exactly like an in-app tap.
//
// requireOptionalNativeModule (not requireNativeModule) so a binary that
// predates this native module degrades to no-ops instead of crashing at
// import — matters because JS-only OTA updates can land on older APKs.
import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type MediaAction = 'playpause' | 'next' | 'previous';

export interface MediaMeta {
  title: string;
  artist: string;
  app: string;
  isPlaying: boolean;
}

interface MediaSessionNativeModule {
  startOrUpdate(meta: MediaMeta): void;
  stop(): void;
  addListener(
    event: 'onMediaAction',
    listener: (payload: { action: MediaAction }) => void
  ): { remove(): void };
}

const nativeModule = requireOptionalNativeModule<MediaSessionNativeModule>('MacRemoteMediaSession');

/** True on a binary that actually ships the native module. */
export const isMediaNotificationSupported = nativeModule != null;

export function startOrUpdate(meta: MediaMeta): void {
  nativeModule?.startOrUpdate(meta);
}

export function stop(): void {
  nativeModule?.stop();
}

/** Subscribe to notification / lockscreen / QS transport-button presses. */
export function addActionListener(cb: (action: MediaAction) => void): () => void {
  if (!nativeModule) return () => undefined;
  const sub = nativeModule.addListener('onMediaAction', ({ action }) => cb(action));
  return () => sub.remove();
}

/**
 * Request POST_NOTIFICATIONS on Android 13+ (auto-granted below 33). Call
 * before enabling the notification so the foreground service's notification
 * is actually shown.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const version =
    typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (Number.isNaN(version) || version < 33) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
