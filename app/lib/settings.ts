// App-global preferences (not per-device) persisted in AsyncStorage. Kept
// separate from lib/devices.ts (device list) and lib/storage.ts (legacy server
// config) so a preference read never touches the device model.
import AsyncStorage from '@react-native-async-storage/async-storage';

const MEDIA_NOTIFICATION_KEY = 'macremote:mediaNotificationEnabled';

/** "Media controls in notifications" toggle. Default OFF. */
export async function getMediaNotificationEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(MEDIA_NOTIFICATION_KEY);
  return raw === 'true';
}

export async function setMediaNotificationEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(MEDIA_NOTIFICATION_KEY, enabled ? 'true' : 'false');
}

const READING_PAGE_MODE_KEY = 'macremote:readingPageMode';

/** Which keys the reading pad's page turns send:
 *  'arrows' -> prev=left, next=right; 'space' -> prev=pageup, next=space. */
export type ReadingPageMode = 'arrows' | 'space';

/** Reading pad page-turn key mode. Default 'arrows'. */
export async function getReadingPageMode(): Promise<ReadingPageMode> {
  const raw = await AsyncStorage.getItem(READING_PAGE_MODE_KEY);
  return raw === 'space' ? 'space' : 'arrows';
}

export async function setReadingPageMode(mode: ReadingPageMode): Promise<void> {
  await AsyncStorage.setItem(READING_PAGE_MODE_KEY, mode);
}
