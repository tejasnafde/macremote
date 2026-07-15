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
