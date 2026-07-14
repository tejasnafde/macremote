// Per-device persisted choice of which /displays entry the brightness
// buttons should target, for Macs that report more than one display. Single
// AsyncStorage key holding a small {deviceId: displayId} map so switching
// between saved Macs (see lib/devices.ts) never applies one Mac's chosen
// monitor to another's brightness calls.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'macremote:brightnessTarget';

type TargetMap = Record<string, string>;

async function readMap(): Promise<TargetMap> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as TargetMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** null when no choice has been made yet for this device (classic/default target). */
export async function getBrightnessTarget(deviceId: string): Promise<string | null> {
  const map = await readMap();
  return map[deviceId] ?? null;
}

export async function setBrightnessTarget(deviceId: string, displayId: string): Promise<void> {
  const map = await readMap();
  map[deviceId] = displayId;
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}
