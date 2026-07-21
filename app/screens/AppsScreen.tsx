// Window switcher + per-app audio, stacked on one screen. GET /windows
// groups windows per display (section header per monitor); tapping a row
// raises that specific window via POST /windows/{id}/focus. Servers older
// than v0.4 404 on /windows, so the screen falls back to the flat GET /apps
// list and behaves exactly like the pre-v0.4 switcher. Below the windows, a
// "App volume" section lists Background Music per-app volumes with compact
// throttled sliders; when the driver is missing it degrades to one quiet
// hint row, and when /audio/apps does not exist at all the section hides.
// Row/list styling mirrors DevicesScreen so the "list" screens read as one
// family; loading / empty / offline states match its language too.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HSlider } from '../components/HSlider';
import { PressableScale } from '../components/PressableScale';
import { IconArrowLeft, IconMonitor, IconRefresh, IconSliders, IconWifiOff } from '../components/icons';
import { useToast } from '../components/Toast';
import { AppEntry, AudioApp, DisplayWindows, WindowEntry, api, ApiError } from '../lib/api';
import { colors, fonts, radii, spacing } from '../theme';

type LoadState = 'loading' | 'ready' | 'offline';

type SwitcherData =
  | { kind: 'windows'; displays: DisplayWindows[] }
  | { kind: 'apps'; apps: AppEntry[] };

type AudioState =
  | { kind: 'hidden' } // endpoint missing or errored: pretend the feature does not exist
  | { kind: 'unavailable' } // server reachable but Background Music driver not installed
  | { kind: 'ready'; apps: AudioApp[] };

export function AppsScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [data, setData] = useState<SwitcherData>({ kind: 'windows', displays: [] });
  const [audio, setAudio] = useState<AudioState>({ kind: 'hidden' });
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const switchingRef = useRef(false);

  const loadWindows = useCallback(async () => {
    try {
      const res = await api.listWindows();
      setData({ kind: 'windows', displays: res.displays });
      setState('ready');
    } catch (err) {
      // Older server without /windows: keep the screen useful with the flat
      // app list. Anything else is a real connectivity problem.
      if (err instanceof ApiError && err.status === 404) {
        const res = await api.listApps();
        setData({ kind: 'apps', apps: res.apps });
        setState('ready');
        return;
      }
      throw err;
    }
  }, []);

  const loadAudio = useCallback(async () => {
    // Audio problems never flip the screen offline; the windows list is the
    // primary feature and per-app volume just hides when it cannot load.
    try {
      const res = await api.listAudioApps();
      setAudio(res.available ? { kind: 'ready', apps: res.apps } : { kind: 'unavailable' });
    } catch {
      setAudio({ kind: 'hidden' });
    }
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setState('loading');
      try {
        await Promise.all([loadWindows(), loadAudio()]);
      } catch {
        if (mode === 'initial') setState('offline');
        else toast.show('Could not refresh windows', 1600);
      }
    },
    [loadAudio, loadWindows, toast]
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load('refresh');
    setRefreshing(false);
  }, [load]);

  async function handleFocusWindow(win: WindowEntry) {
    if (switchingRef.current || win.active) return;
    switchingRef.current = true;
    try {
      const res = await api.focusWindow(win.id);
      if (res.gone) {
        switchingRef.current = false;
        toast.show('That window closed', 1800);
        load('refresh');
        return;
      }
      toast.show(`Focused ${win.app}`, 1600);
      // Give the Mac a beat to raise the window, then re-pull so the active
      // badge lands on the newly focused window.
      setTimeout(() => {
        load('refresh').finally(() => {
          switchingRef.current = false;
        });
      }, 500);
    } catch (err) {
      switchingRef.current = false;
      toast.show(err instanceof ApiError ? err.message : 'Could not focus that window', 2000);
    }
  }

  async function handleFocusApp(app: AppEntry) {
    if (switchingRef.current || app.active) return;
    switchingRef.current = true;
    try {
      await api.focusApp(app.bundle_id);
      toast.show(`Switched to ${app.name}`, 1600);
      setTimeout(() => {
        load('refresh').finally(() => {
          switchingRef.current = false;
        });
      }, 500);
    } catch (err) {
      switchingRef.current = false;
      toast.show(err instanceof ApiError ? err.message : 'Could not switch apps', 2000);
    }
  }

  function sendAppVolume(name: string, v: number) {
    // Throttled drag updates fail silently; the commit on release surfaces
    // anything that matters.
    api.setAppVolume(name, v).catch(() => undefined);
  }

  async function commitAppVolume(name: string, v: number) {
    try {
      const res = await api.setAppVolume(name, v);
      if (!res.ok && res.available === false) {
        // Driver vanished between listing and setting (uninstalled or
        // stopped): degrade to the same quiet hint the probe would show.
        setAudio({ kind: 'unavailable' });
      }
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Could not set app volume', 2000);
    }
  }

  const windowsEmpty =
    data.kind === 'windows'
      ? data.displays.every((d) => d.windows.length === 0)
      : data.apps.length === 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingLeft: insets.left + spacing.screenX + 2, paddingRight: insets.right + spacing.screenX + 2 },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.off55} colors={[colors.green]} />
      }
    >
      <View style={styles.header}>
        <PressableScale style={styles.iconBtn} onPress={onClose} accessibilityLabel="Back to remote">
          <IconArrowLeft size={20} color={colors.off72} />
        </PressableScale>
        <View style={styles.headTexts}>
          <Text style={styles.head}>Apps</Text>
          <Text style={styles.sub}>Focus a window, balance app audio.</Text>
        </View>
        <PressableScale style={styles.iconBtn} onPress={() => load('refresh')} accessibilityLabel="Refresh windows">
          <IconRefresh size={18} color={colors.off72} />
        </PressableScale>
      </View>

      {state === 'loading' && (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.green} />
        </View>
      )}

      {state === 'offline' && (
        <View style={styles.centerState}>
          <View style={styles.offlineIcon}>
            <IconWifiOff size={26} color={colors.ember} />
          </View>
          <Text style={styles.offlineTitle}>Can&apos;t reach your Mac</Text>
          <Text style={styles.offlineBody}>Make sure both devices are awake and on the same network.</Text>
          <PressableScale style={styles.retryBtn} onPress={() => load('initial')}>
            <IconRefresh size={15} color={colors.greenInk} />
            <Text style={styles.retryLabel}>Retry</Text>
          </PressableScale>
        </View>
      )}

      {state === 'ready' && windowsEmpty && (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>No windows reported</Text>
          <Text style={styles.offlineBody}>Nothing is open that the Mac can raise right now.</Text>
        </View>
      )}

      {state === 'ready' &&
        data.kind === 'windows' &&
        data.displays.map((display) => (
          <View key={display.id}>
            {display.windows.length > 0 && (
              <View style={styles.sectionHead}>
                <IconMonitor size={14} color={colors.off38} />
                <Text style={styles.sectionHeadText} numberOfLines={1}>
                  {display.name}
                </Text>
              </View>
            )}
            {display.windows.map((win) => (
              <PressableScale
                key={win.id}
                style={[styles.row, win.active && styles.rowActive]}
                onPress={() => handleFocusWindow(win)}
              >
                <View style={[styles.dot, win.active && styles.dotActive]} />
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {win.app}
                  </Text>
                  <Text style={styles.glance} numberOfLines={1}>
                    {win.title || 'Untitled window'}
                  </Text>
                </View>
                {win.active && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>Active</Text>
                  </View>
                )}
              </PressableScale>
            ))}
          </View>
        ))}

      {state === 'ready' &&
        data.kind === 'apps' &&
        data.apps.map((app) => (
          <PressableScale
            key={app.bundle_id}
            style={[styles.row, app.active && styles.rowActive]}
            onPress={() => handleFocusApp(app)}
          >
            <View style={[styles.dot, app.active && styles.dotActive]} />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {app.name}
              </Text>
              <Text style={styles.glance} numberOfLines={1}>
                {app.active ? 'frontmost' : 'tap to switch'}
              </Text>
            </View>
            {app.active && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>Active</Text>
              </View>
            )}
          </PressableScale>
        ))}

      {state === 'ready' && audio.kind !== 'hidden' && (
        <View>
          <View style={styles.sectionHead}>
            <IconSliders size={14} color={colors.off38} />
            <Text style={styles.sectionHeadText}>App volume</Text>
          </View>
          {audio.kind === 'unavailable' ? (
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                Per-app volume needs the Background Music driver on the Mac
              </Text>
            </View>
          ) : audio.apps.length === 0 ? (
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>No apps are playing audio right now</Text>
            </View>
          ) : (
            audio.apps.map((app) => (
              <View key={app.name} style={styles.audioRow}>
                <Text style={styles.audioName} numberOfLines={1}>
                  {app.name}
                </Text>
                <HSlider
                  value={app.volume}
                  onSend={(v) => sendAppVolume(app.name, v)}
                  onCommit={(v) => commitAppVolume(app.name, v)}
                  showValue
                  accessibilityLabel={`${app.name} volume`}
                />
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink950 },
  content: {},
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8, marginBottom: 18 },
  headTexts: { flex: 1, minWidth: 0 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: { fontFamily: fonts.display, fontSize: 24, color: colors.off },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.off55, marginTop: 6 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeadText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.off38,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

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
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink500 },
  dotActive: { backgroundColor: colors.green },
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

  // Per-app audio rows: fixed-width name column keeps every slider's start
  // aligned; at 360px the content column is ~320px, so 96 name + slider +
  // 38 readout leaves the track roughly 140px wide, comfortably draggable.
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 10,
  },
  audioName: { width: 96, fontFamily: fonts.semiBold, fontSize: 13.5, color: colors.off },
  // Deliberately quiet (no error colors): the driver being absent is a
  // setup fact, not a failure.
  hintRow: {
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 10,
  },
  hintText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.off55, lineHeight: 18 },

  centerState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  offlineIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ember16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  offlineTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.off, marginBottom: 4 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.off, marginBottom: 4 },
  offlineBody: { fontFamily: fonts.body, fontSize: 13.5, color: colors.off55, textAlign: 'center', maxWidth: 260, marginBottom: 18 },
  retryBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  retryLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.greenInk },
});
