// Devices screen, ported from deck.html's #screenDevices: a list of known
// Macs with an online dot (probed via /health + /version with a short
// timeout whenever this screen opens), glance info for the active device
// pulled live from /status, tap-to-switch, a dashed "Windows support, soon"
// teaser row, and "+ Add device" into the Setup flow.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/PressableScale';
import { IconPlus, IconWindows } from '../components/icons';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import {
  Device,
  getDevicesState,
  probeDevice,
  removeDevice,
  renameDevice,
  setActiveDevice,
} from '../lib/devices';
import { colors, fonts, radii, spacing } from '../theme';

interface RowState {
  probing: boolean;
  online: boolean;
  version: string | null;
}

export function DevicesScreen({
  onSwitched,
  onAddDevice,
}: {
  onSwitched: () => void;
  onAddDevice: () => void;
}) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [glance, setGlance] = useState<string>('');

  const refresh = useCallback(async () => {
    const state = await getDevicesState();
    setDevices(state.devices);
    setActiveId(state.activeId);
    setRowState(
      Object.fromEntries(state.devices.map((d) => [d.id, { probing: true, online: false, version: null }]))
    );

    await Promise.all(
      state.devices.map(async (d) => {
        const result = await probeDevice(d);
        setRowState((prev) => ({
          ...prev,
          [d.id]: { probing: false, online: result.online, version: result.version },
        }));
        if (d.id === state.activeId && result.online) {
          try {
            const status = await api.status();
            const parts = [
              status.battery != null ? `battery ${status.battery}%` : null,
              status.volume != null ? `vol ${status.volume}` : null,
              result.version ? `v${result.version}` : null,
            ].filter(Boolean);
            setGlance(parts.join(' · '));
          } catch {
            // active device answered /health but not /status yet; glance just stays blank
          }
        }
      })
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  function handleLongPress(device: Device) {
    Alert.alert(device.name, undefined, [
      { text: 'Rename', onPress: () => setRenaming({ id: device.id, name: device.name }) },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Remove device', `Stop controlling ${device.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                await removeDevice(device.id);
                const state = await getDevicesState();
                if (state.devices.length === 0) {
                  onAddDevice();
                  return;
                }
                toast.show(`${device.name} removed`, 1600);
                refresh();
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleRenameSave() {
    if (!renaming) return;
    await renameDevice(renaming.id, renaming.name);
    setRenaming(null);
    refresh();
  }

  async function handleSwitch(device: Device) {
    const state = rowState[device.id];
    if (device.id === activeId) {
      onSwitched();
      return;
    }
    if (state && !state.online) {
      toast.show(`${device.name} is offline`, 1600);
      return;
    }
    await setActiveDevice(device.id);
    setActiveId(device.id);
    toast.show(`Now controlling ${device.name}`, 1800);
    setTimeout(onSwitched, 500);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 76 }]}
    >
      <Text style={styles.head}>My Devices</Text>
      <Text style={styles.sub}>Control any machine on your network.</Text>

      {devices.map((device) => (
        <DeviceRow
          key={device.id}
          device={device}
          isActive={device.id === activeId}
          state={rowState[device.id]}
          glance={device.id === activeId ? glance : null}
          onPress={() => handleSwitch(device)}
          onLongPress={() => handleLongPress(device)}
        />
      ))}

      {renaming && (
        <View style={styles.renameBar}>
          <TextInput
            style={styles.renameInput}
            value={renaming.name}
            onChangeText={(name) => setRenaming({ ...renaming, name })}
            autoFocus
            selectTextOnFocus
            placeholder="Device name"
            placeholderTextColor={colors.off38}
          />
          <PressableScale style={styles.renameBtn} onPress={handleRenameSave}>
            <Text style={styles.renameBtnText}>Save</Text>
          </PressableScale>
          <PressableScale style={[styles.renameBtn, styles.renameCancel]} onPress={() => setRenaming(null)}>
            <Text style={styles.renameCancelText}>Cancel</Text>
          </PressableScale>
        </View>
      )}

      <PressableScale style={[styles.row, styles.teaserRow]} onPress={() => toast.show('Windows support is coming soon', 1800)}>
        <IconWindows size={20} color={colors.off38} />
        <View style={styles.info}>
          <Text style={styles.name}>Windows support</Text>
          <Text style={styles.glance}>PCs join the deck soon</Text>
        </View>
        <View style={styles.soonPill}>
          <Text style={styles.soonPillText}>Soon</Text>
        </View>
      </PressableScale>

      <PressableScale style={[styles.row, styles.addRow]} onPress={onAddDevice}>
        <IconPlus size={16} color={colors.off72} />
        <Text style={styles.addLabel}>Add device</Text>
      </PressableScale>
    </ScrollView>
  );
}

function DeviceRow({
  device,
  isActive,
  state,
  glance,
  onPress,
  onLongPress,
}: {
  device: Device;
  isActive: boolean;
  state: RowState | undefined;
  glance: string | null;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const shakeX = useSharedValue(0);
  const isOffline = state && !state.probing && !state.online;

  function handlePress() {
    if (isOffline) {
      shakeX.value = withSequence(
        withTiming(-6, { duration: 90 }),
        withTiming(6, { duration: 180 }),
        withTiming(0, { duration: 90 })
      );
    }
    onPress();
  }

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const glanceText = state?.probing
    ? 'checking…'
    : isOffline
      ? 'offline'
      : glance || (state?.version ? `online · v${state.version}` : 'online');

  return (
    <Animated.View style={shakeStyle}>
      <PressableScale
        style={[styles.row, isActive && styles.rowActive, isOffline && styles.rowOffline]}
        onPress={handlePress}
        onLongPress={onLongPress}
      >
        {state?.probing ? (
          <ActivityIndicator size="small" color={colors.off38} />
        ) : (
          <View style={[styles.dot, state?.online && styles.dotOnline]} />
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {device.name}
          </Text>
          <Text style={styles.glance} numberOfLines={1}>
            {glanceText}
          </Text>
        </View>
        {isActive && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>Active</Text>
          </View>
        )}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink950 },
  content: { paddingHorizontal: spacing.screenX + 2 },
  head: { fontFamily: fonts.display, fontSize: 24, color: colors.off, marginTop: 8 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.off55, marginTop: 6, marginBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 10,
  },
  rowActive: { borderColor: colors.green24, backgroundColor: colors.ink800 },
  rowOffline: { opacity: 0.55 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink500 },
  dotOnline: { backgroundColor: colors.green },
  info: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: fonts.extraBold, fontSize: 15.5, color: colors.off, letterSpacing: -0.1 },
  glance: { fontFamily: fonts.body, fontSize: 12, color: colors.off55 },
  tag: {
    backgroundColor: colors.green,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  tagText: {
    fontFamily: fonts.extraBold,
    fontSize: 10.5,
    color: colors.greenInk,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  teaserRow: { opacity: 0.5, backgroundColor: 'transparent', borderStyle: 'dashed' },
  soonPill: { backgroundColor: colors.ink700, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full },
  soonPillText: {
    fontFamily: fonts.extraBold,
    fontSize: 10.5,
    color: colors.off55,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  addRow: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    justifyContent: 'center',
    minHeight: 58,
  },
  addLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.off72 },
  renameBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap,
    marginTop: spacing.gap,
    padding: spacing.gap,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink850,
  },
  renameInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.off,
    paddingVertical: 8,
    paddingHorizontal: spacing.gap,
  },
  renameBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.green,
  },
  renameBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink950 },
  renameCancel: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  renameCancelText: { fontFamily: fonts.bold, fontSize: 13, color: colors.off72 },
});
