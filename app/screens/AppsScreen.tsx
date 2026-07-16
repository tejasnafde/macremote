// App switcher: lists the Mac's running apps (frontmost first) from GET /apps
// and raises one via POST /apps/focus. Row/list styling mirrors DevicesScreen
// so the two "list" screens read as one family; loading / empty / offline
// states match its language too. Pull-to-refresh plus a header refresh button.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/PressableScale';
import { IconArrowLeft, IconRefresh, IconWifiOff } from '../components/icons';
import { useToast } from '../components/Toast';
import { AppEntry, api, ApiError } from '../lib/api';
import { colors, fonts, radii, spacing } from '../theme';

type LoadState = 'loading' | 'ready' | 'offline';

export function AppsScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const switchingRef = useRef(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setState('loading');
    try {
      const res = await api.listApps();
      setApps(res.apps);
      setState('ready');
    } catch {
      if (mode === 'initial') setState('offline');
      else toast.show('Could not refresh apps', 1600);
    }
  }, [toast]);

  useEffect(() => {
    load('initial');
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load('refresh');
    setRefreshing(false);
  }, [load]);

  async function handleFocus(app: AppEntry) {
    if (switchingRef.current || app.active) return;
    switchingRef.current = true;
    try {
      await api.focusApp(app.bundle_id);
      toast.show(`Switched to ${app.name}`, 1600);
      // Give the Mac a beat to raise the window, then re-pull so the active
      // dot lands on the new frontmost app.
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
          <Text style={styles.sub}>Switch the app in focus on your Mac.</Text>
        </View>
        <PressableScale style={styles.iconBtn} onPress={() => load('refresh')} accessibilityLabel="Refresh apps">
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

      {state === 'ready' && apps.length === 0 && (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>No apps reported</Text>
          <Text style={styles.offlineBody}>Nothing is running that the Mac can raise right now.</Text>
        </View>
      )}

      {state === 'ready' &&
        apps.map((app) => (
          <PressableScale
            key={app.bundle_id}
            style={[styles.row, app.active && styles.rowActive]}
            onPress={() => handleFocus(app)}
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
