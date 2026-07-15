// Main Deck screen, ported from deck.html's #screenMain + status strip +
// volume rail + lock overlay + sleep sheet. This single screen carries every
// "state" the mockup demoed via its chip-bar switcher (Remote / Timer /
// Playing / Offline / Update) as live derived state from /status polling and
// connectivity, not separate routes.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/PressableScale';
import { useToast } from '../components/Toast';
import {
  IconArrowUpRight,
  IconBattery,
  IconBrightnessDown,
  IconBrightnessUp,
  IconChevronDouble,
  IconCursor,
  IconDownload,
  IconHelp,
  IconLock,
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRefresh,
  IconSeekBack10,
  IconSeekForward10,
  IconSleep,
  IconWifiOff,
  IconX,
} from '../components/icons';
import { api, ApiError, BrowserTab, BrowserTabAction, Display, StatusResponse } from '../lib/api';
import { checkForUpdate, currentVersion, downloadAndInstall } from '../lib/apk';
import { getActiveDevice } from '../lib/devices';
import { getBrightnessTarget, setBrightnessTarget } from '../lib/displayTarget';
import { colors, fonts, radii, railWidth, spacing } from '../theme';
import { DisplayChooser } from './remote/DisplayChooser';
import { DisplayHelpCard } from './remote/DisplayHelpCard';
import { LockOverlay } from './remote/LockOverlay';
import { SleepSheet } from './remote/SleepSheet';
import { VolumeRail } from './remote/VolumeRail';

const POLL_MS = 3000;

function fmtTime(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

interface RemoteScreenProps {
  onOpenDevices: () => void;
  refreshToken: number;
}

export function RemoteScreen({ onOpenDevices, refreshToken }: RemoteScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [deviceName, setDeviceName] = useState('Mac');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [online, setOnline] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);
  const [optimisticTabPlaying, setOptimisticTabPlaying] = useState<Record<number, boolean>>({});
  const [trackToast, setTrackToast] = useState<string | null>(null);
  const [lockOpen, setLockOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [optimisticSleepSeconds, setOptimisticSleepSeconds] = useState<number | null>(null);

  // Multi-display brightness targeting: /displays is fetched once per
  // screen mount / device switch, cached in state for the session, never
  // polled. null = not fetched yet (or the probe failed) — both cases
  // degrade to classic single-display behavior with no error surfaced.
  const [displays, setDisplays] = useState<Display[] | null>(null);
  const [brightnessTargetId, setBrightnessTargetId] = useState<string | null>(null);
  const [displayChooserOpen, setDisplayChooserOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpAutoShownRef = useRef(false);
  const keysToastShownRef = useRef(false);

  const [updateInfo, setUpdateInfo] = useState<{ version: string; apkUrl: string } | null>(null);
  const [updatePhase, setUpdatePhase] = useState<'idle' | 'downloading'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timerGraceUntil = useRef(0);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s);
      setOnline(true);
      // Browser playback reports no now-playing state, so only let the server
      // override the optimistic play/pause icon when it actually knows.
      if (s.now_playing?.state) setOptimisticPlaying(null);
      // Tab commands land on the extension within ~2s, well inside the 3s
      // poll cycle, so every poll already carries server truth: drop the
      // optimistic overrides and let the fetched tab.playing render instead.
      setOptimisticTabPlaying({});
      // Reconcile the timer pill with server truth on every poll; the short
      // grace window covers the beat between arming and the server reporting it.
      if (s.sleep_timer) {
        setOptimisticSleepSeconds(null);
        timerGraceUntil.current = 0;
      } else if (Date.now() > timerGraceUntil.current) {
        setOptimisticSleepSeconds(null);
      }
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    getActiveDevice().then((d) => {
      setDeviceName(d?.name ?? 'Mac');
      setDeviceId(d?.id ?? null);
      if (d) {
        getBrightnessTarget(d.id).then(setBrightnessTargetId);
      } else {
        setBrightnessTargetId(null);
      }
    });
  }, [refreshToken]);

  // Lazy, session-cached /displays probe — deliberately not part of the 3s
  // status poll. A failure (or a single-display Mac) just leaves `displays`
  // empty and every brightness call below falls back to the classic
  // no-target request, so there is nothing to surface as an error here.
  useEffect(() => {
    let cancelled = false;
    setDisplays(null);
    api
      .displays()
      .then((res) => {
        if (!cancelled) setDisplays(res.displays);
      })
      .catch(() => {
        if (!cancelled) setDisplays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    function stopPolling() {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    function startPolling() {
      stopPolling();
      refreshStatus();
      pollRef.current = setInterval(refreshStatus, POLL_MS);
    }
    startPolling();
    let appState = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && appState !== 'active') startPolling();
      else if (next !== 'active') stopPolling();
      appState = next;
    });
    return () => {
      stopPolling();
      sub.remove();
    };
  }, [refreshStatus, refreshToken]);

  // Auto-check for a newer APK once per launch (throttled to once/day inside
  // checkForUpdate); shown as the rail-aware banner below instead of an Alert.
  useEffect(() => {
    checkForUpdate(false).then((latest) => {
      if (latest) setUpdateInfo({ version: latest.version, apkUrl: latest.apkUrl });
    });
  }, []);

  function flashTrackToast(msg: string) {
    setTrackToast(msg);
    if (trackToastTimer.current) clearTimeout(trackToastTimer.current);
    trackToastTimer.current = setTimeout(() => setTrackToast(null), 1100);
  }

  async function handlePrev() {
    flashTrackToast('Previous track');
    try {
      await api.previous();
      await refreshStatus();
    } catch (err) {
      toast.show(errMessage(err));
    }
  }
  async function handleNext() {
    flashTrackToast('Next track');
    try {
      await api.next();
      await refreshStatus();
    } catch (err) {
      toast.show(errMessage(err));
    }
  }

  const npState = status?.now_playing?.state?.toLowerCase() ?? null;
  const serverIsPlaying = npState ? npState.includes('play') : false;
  const isPlaying = optimisticPlaying ?? serverIsPlaying;

  async function handlePlayPause() {
    setOptimisticPlaying(!isPlaying);
    try {
      await api.playPause();
      await refreshStatus();
    } catch (err) {
      setOptimisticPlaying(null);
      toast.show(errMessage(err));
    }
  }

  async function handleTabCommand(tab: BrowserTab, action: BrowserTabAction) {
    if (action === 'playpause') {
      setOptimisticTabPlaying((prev) => ({ ...prev, [tab.tab_id]: !(prev[tab.tab_id] ?? tab.playing) }));
    }
    try {
      await api.tabCommand(tab.tab_id, tab.browser, action);
    } catch (err) {
      if (action === 'playpause') {
        setOptimisticTabPlaying((prev) => {
          const next = { ...prev };
          delete next[tab.tab_id];
          return next;
        });
      }
      toast.show(errMessage(err));
    }
  }

  async function handleSetVolume(v: number) {
    try {
      await api.setVolume(Math.round(v));
    } catch {
      // throttled drag updates fail silently; the final commit will retry
    }
  }
  async function handleCommitVolume(v: number) {
    try {
      await api.setVolume(Math.round(v));
      await refreshStatus();
    } catch (err) {
      toast.show(errMessage(err));
    }
  }
  async function handleToggleMute() {
    try {
      await api.volumeMute();
      await refreshStatus();
    } catch (err) {
      toast.show(errMessage(err));
    }
  }

  // Only pass a display id downstream when the Mac actually reports more
  // than one — a lone builtin display keeps calling the plain /brightness/*
  // endpoints exactly as before, matching today's classic behavior.
  const hasMultipleDisplays = (displays?.length ?? 0) > 1;
  const activeDisplay = hasMultipleDisplays
    ? (displays?.find((d) => d.id === (brightnessTargetId ?? 'builtin')) ?? null)
    : null;
  const showBrightnessTargetLabel = Boolean(activeDisplay && !activeDisplay.builtin);

  function currentBrightnessTarget(): string | undefined {
    return hasMultipleDisplays && brightnessTargetId ? brightnessTargetId : undefined;
  }

  const brightHold = useRef<ReturnType<typeof setInterval> | null>(null);
  function startBrightnessHold(direction: 'up' | 'down') {
    const target = currentBrightnessTarget();
    const action = () => (direction === 'up' ? api.brightnessUp(target) : api.brightnessDown(target));
    // First tap awaits the result: if the external monitor ignores DDC, say so
    // once and skip the hold-repeat (pointless to hammer an unsupported display).
    action()
      .then((res) => {
        if (res?.display_unsupported) {
          // First time per session: open the full help card. After that a
          // short toast plus the "?" icon (which reopens the card on demand).
          if (!helpAutoShownRef.current) {
            helpAutoShownRef.current = true;
            setHelpOpen(true);
          } else {
            toast.show('This display is not accepting brightness commands', 2400);
          }
          return;
        }
        toast.show(direction === 'up' ? 'Brightness up' : 'Brightness down', 1100);
        if (brightHold.current) clearInterval(brightHold.current);
        brightHold.current = setInterval(() => {
          action().catch(() => undefined);
        }, 220);
      })
      .catch(() => undefined);
  }
  function stopBrightnessHold() {
    if (brightHold.current) {
      clearInterval(brightHold.current);
      brightHold.current = null;
      refreshStatus();
    }
  }

  async function handleSelectDisplay(id: string) {
    setBrightnessTargetId(id);
    setDisplayChooserOpen(false);
    if (deviceId) {
      await setBrightnessTarget(deviceId, id);
    }
  }

  async function handleSeek(seconds: number) {
    try {
      const res = await api.seek(seconds);
      if (res.via === 'keys' && !keysToastShownRef.current) {
        keysToastShownRef.current = true;
        toast.show('Seeked in focused app', 2000);
      }
    } catch (err) {
      toast.show(errMessage(err));
    }
  }

  async function handleLockPress() {
    setLockOpen(true);
    try {
      await api.lock();
    } catch (err) {
      toast.show(errMessage(err));
    }
  }

  async function handleBanishCursor() {
    try {
      await api.banishCursor();
      toast.show('Cursor parked', 1400);
    } catch (err) {
      toast.show(errMessage(err));
    }
  }

  const sleepRemaining = optimisticSleepSeconds ?? status?.sleep_timer?.remaining_seconds ?? null;

  async function handleArmTimer(minutes: number, mode: 'sleep' | 'blackout' = 'sleep') {
    timerGraceUntil.current = Date.now() + 8000;
    setOptimisticSleepSeconds(minutes * 60);
    try {
      await api.setSleepTimer(minutes, mode);
      toast.show(`Sleep timer started, ${minutes} min`, 2000);
      await refreshStatus();
    } catch (err) {
      setOptimisticSleepSeconds(null);
      toast.show(errMessage(err));
    }
  }
  async function handleCancelTimer() {
    timerGraceUntil.current = 0;
    setOptimisticSleepSeconds(null);
    setSheetOpen(false);
    try {
      await api.cancelSleepTimer();
      toast.show('Sleep timer cancelled', 1800);
      await refreshStatus();
    } catch (err) {
      toast.show(errMessage(err));
    }
  }
  async function handleSleepNow() {
    try {
      await api.sleep();
    } catch (err) {
      toast.show(errMessage(err));
    }
  }
  async function handleBlackoutNow() {
    try {
      await api.blackout();
      toast.show('Volume and screens to zero', 1800);
    } catch (err) {
      toast.show(errMessage(err));
    }
  }
  async function handleScreensOn() {
    try {
      await api.screensOn();
      toast.show('Restoring volume and screens', 1800);
    } catch (err) {
      toast.show(errMessage(err));
    }
  }

  async function handleRetry() {
    setRetrying(true);
    await refreshStatus();
    setRetrying(false);
    if (online) toast.show('Reconnected', 2000);
  }

  async function handleDownloadUpdate() {
    if (!updateInfo) return;
    setUpdatePhase('downloading');
    setUpdateProgress(0);
    try {
      await downloadAndInstall(updateInfo.apkUrl, setUpdateProgress);
      toast.show('Installer opened. Follow the prompt on your phone.', 2600);
      setUpdateInfo(null);
      setUpdatePhase('idle');
    } catch (err) {
      setUpdatePhase('idle');
      toast.show(err instanceof Error ? err.message : 'Update failed');
    }
  }

  const nowPlaying = status?.now_playing;
  const hasNowPlaying = Boolean(nowPlaying?.title);

  return (
    <View style={styles.root}>
      <StatusStrip
        online={online}
        deviceName={deviceName}
        nowPlaying={hasNowPlaying ? nowPlaying! : null}
        isPlaying={isPlaying}
        battery={status?.battery ?? null}
        onOpenDevices={onOpenDevices}
      />

      <View style={[styles.main, { paddingBottom: insets.bottom + 20 }]}>
        {updateInfo && (
          <UpdateBanner
            version={updateInfo.version}
            fromVersion={currentVersion()}
            phase={updatePhase}
            progress={updateProgress}
            onDownload={handleDownloadUpdate}
          />
        )}

        {!online && (
          <OfflineBanner retrying={retrying} onRetry={handleRetry} />
        )}

        {online && hasNowPlaying && (
          <NowPlayingHero title={nowPlaying!.title!} artist={nowPlaying!.artist} app={nowPlaying!.app} isPlaying={isPlaying} />
        )}

        {online && status?.browser_tabs && status.browser_tabs.length > 0 && (
          <BrowserTabsSection
            tabs={status.browser_tabs}
            optimisticPlaying={optimisticTabPlaying}
            onCommand={handleTabCommand}
          />
        )}

        <View style={[styles.thumbZone, !online && styles.inert]}>
          {sleepRemaining != null && (
            <TimerPill
              remainingSeconds={sleepRemaining}
              label={status?.sleep_timer?.mode === 'blackout' ? 'screens off' : 'sleep timer'}
              onPress={() => setSheetOpen(true)}
              onCancel={handleCancelTimer}
            />
          )}

          <View style={styles.transport}>
            {trackToast && (
              <View style={styles.trackToast}>
                <Text style={styles.trackToastText}>{trackToast}</Text>
              </View>
            )}
            <PressableScale style={styles.tBtnSide} onPress={handlePrev} accessibilityLabel="Previous track">
              <IconPrev size={24} color={colors.off} />
            </PressableScale>
            <PressableScale style={styles.tBtnPlay} onPress={handlePlayPause} accessibilityLabel="Play or pause">
              {isPlaying ? <IconPause size={38} color={colors.greenInk} /> : <IconPlay size={38} color={colors.greenInk} />}
            </PressableScale>
            <PressableScale style={styles.tBtnSide} onPress={handleNext} accessibilityLabel="Next track">
              <IconNext size={24} color={colors.off} />
            </PressableScale>
          </View>

          <View style={styles.seekRow}>
            <PressableScale style={styles.seekBtn} onPress={() => handleSeek(-10)} accessibilityLabel="Back 10 seconds">
              <IconSeekBack10 size={27} color={colors.off72} />
            </PressableScale>
            <PressableScale style={styles.seekBtn} onPress={() => handleSeek(10)} accessibilityLabel="Forward 10 seconds">
              <IconSeekForward10 size={27} color={colors.off72} />
            </PressableScale>
          </View>

          <View style={styles.secondaryRow}>
            <View style={styles.brightCluster}>
              <View style={styles.brightPair}>
                <PressableScale
                  style={styles.sBtn}
                  onPressIn={() => startBrightnessHold('down')}
                  onPressOut={stopBrightnessHold}
                  accessibilityLabel="Brightness down"
                >
                  <IconBrightnessDown size={17} color={colors.off72} />
                </PressableScale>
                <View style={styles.brightUpWrap}>
                  <PressableScale
                    style={styles.sBtn}
                    onPressIn={() => startBrightnessHold('up')}
                    onPressOut={stopBrightnessHold}
                    accessibilityLabel="Brightness up"
                  >
                    <IconBrightnessUp size={17} color={colors.off72} />
                  </PressableScale>
                </View>
              </View>
              {hasMultipleDisplays && (
                <View style={styles.brightTargetRow}>
                  <PressableScale
                    onPress={() => setDisplayChooserOpen(true)}
                    accessibilityLabel="Choose brightness target display"
                    hitSlop={10}
                  >
                    <Text style={styles.brightTargetLabel} numberOfLines={1}>
                      {activeDisplay?.name ?? 'Built-in'}
                    </Text>
                  </PressableScale>
                  {activeDisplay && !activeDisplay.builtin && (
                    <PressableScale
                      onPress={() => setHelpOpen(true)}
                      accessibilityLabel="Why is external brightness not working"
                      hitSlop={10}
                    >
                      <IconHelp size={14} color={colors.off38} />
                    </PressableScale>
                  )}
                </View>
              )}
            </View>
            <PressableScale style={styles.sBtn} onPress={handleLockPress} accessibilityLabel="Lock">
              <IconLock size={17} color={colors.off72} />
            </PressableScale>
            <PressableScale
              style={[styles.sBtn, sleepRemaining != null && styles.sBtnOn]}
              onPress={() => setSheetOpen(true)}
              accessibilityLabel="Sleep timer"
            >
              <IconSleep size={17} color={sleepRemaining != null ? colors.green : colors.off72} />
            </PressableScale>
            <PressableScale style={styles.sBtn} onPress={handleBanishCursor} accessibilityLabel="Park cursor">
              <IconCursor size={17} color={colors.off72} />
            </PressableScale>
          </View>
        </View>
      </View>

      <VolumeRail
        value={status?.volume ?? 0}
        muted={status?.muted ?? false}
        disabled={!online}
        onChangeVolume={handleSetVolume}
        onCommitVolume={handleCommitVolume}
        onToggleMute={handleToggleMute}
      />

      <LockOverlay visible={lockOpen} onUnlock={() => setLockOpen(false)} />

      <DisplayHelpCard visible={helpOpen} onClose={() => setHelpOpen(false)} />

      <DisplayChooser
        visible={displayChooserOpen}
        onClose={() => setDisplayChooserOpen(false)}
        displays={displays ?? []}
        selectedId={brightnessTargetId}
        onSelect={handleSelectDisplay}
      />

      <SleepSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        remainingSeconds={sleepRemaining}
        timerMode={status?.sleep_timer?.mode ?? null}
        onArm={(mins, mode) => {
          handleArmTimer(mins, mode);
        }}
        onCancelTimer={handleCancelTimer}
        onSleepNow={handleSleepNow}
        onBlackoutNow={handleBlackoutNow}
        onScreensOn={handleScreensOn}
      />
    </View>
  );
}

function errMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

/* ---------------------------- status strip ---------------------------- */

function StatusStrip({
  online,
  deviceName,
  nowPlaying,
  isPlaying,
  battery,
  onOpenDevices,
}: {
  online: boolean;
  deviceName: string;
  nowPlaying: { title: string | null; artist: string | null; app: string | null } | null;
  isPlaying: boolean;
  battery: number | null;
  onOpenDevices: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scrollX = useSharedValue(0);
  const label = nowPlaying
    ? `${nowPlaying.title ?? 'Untitled'} · ${nowPlaying.artist ?? 'Unknown'} · ${nowPlaying.app ?? ''}`
    : null;

  useEffect(() => {
    if (label && isPlaying) {
      scrollX.value = withRepeat(withTiming(-220, { duration: 9000, easing: Easing.linear }), -1, false);
    } else {
      scrollX.value = withTiming(scrollX.value, { duration: 0 });
    }
  }, [label, isPlaying, scrollX]);

  const marqueeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: scrollX.value }] }));

  return (
    <View style={[styles.statusStrip, { paddingTop: insets.top + 16 }]}>
      <PressableScale style={styles.conn} onPress={onOpenDevices} accessibilityLabel="Switch device">
        <View style={[styles.connDot, !online && styles.connDotOffline]} />
        <Text style={styles.connLabel} numberOfLines={1}>
          {deviceName}
        </Text>
        <IconChevronDouble size={11} color={colors.off38} />
      </PressableScale>

      <View style={styles.marquee}>
        {label ? (
          <Animated.View style={[styles.marqueeTrack, marqueeStyle]}>
            <Text style={styles.marqueeText} numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
        ) : (
          <Text style={styles.marqueeIdle} numberOfLines={1}>
            Nothing playing
          </Text>
        )}
      </View>

      {battery != null && (
        <View style={styles.battery}>
          <IconBattery size={20} color={colors.off55} />
          <Text style={styles.batteryPct}>{battery}%</Text>
        </View>
      )}
    </View>
  );
}

/* ------------------------------ hero card ------------------------------ */

function NowPlayingHero({
  title,
  artist,
  app,
  isPlaying,
}: {
  title: string;
  artist: string | null;
  app: string | null;
  isPlaying: boolean;
}) {
  const bar1 = useSharedValue(0);
  const bar2 = useSharedValue(0);
  const bar3 = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      bar1.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0.2, { duration: 500 })), -1, true);
      bar2.value = withRepeat(withSequence(withTiming(0.3, { duration: 420 }), withTiming(1, { duration: 420 })), -1, true);
      bar3.value = withRepeat(withSequence(withTiming(1, { duration: 460 }), withTiming(0.3, { duration: 460 })), -1, true);
    }
  }, [isPlaying, bar1, bar2, bar3]);

  const s1 = useAnimatedStyle(() => ({ height: 4 + bar1.value * 8 }));
  const s2 = useAnimatedStyle(() => ({ height: 4 + bar2.value * 8 }));
  const s3 = useAnimatedStyle(() => ({ height: 4 + bar3.value * 8 }));

  return (
    <View style={styles.npHero}>
      <View style={styles.npCard}>
        <View style={styles.npArt} />
        <View style={styles.npBody}>
          <Text style={styles.npTitle} numberOfLines={1}>
            {title}
          </Text>
          {artist ? (
            <Text style={styles.npArtist} numberOfLines={1}>
              {artist}
            </Text>
          ) : null}
          <View style={styles.npMeta}>
            {app ? (
              <View style={styles.npAppPill}>
                <Text style={styles.npAppPillText}>{app}</Text>
              </View>
            ) : null}
            <View style={styles.eqBars}>
              <Animated.View style={[styles.eqBar, s1]} />
              <Animated.View style={[styles.eqBar, s2]} />
              <Animated.View style={[styles.eqBar, s3]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/* --------------------------- browser tabs section --------------------------- */

const BROWSER_ROW_HEIGHT = 42;
const BROWSER_MAX_ROWS = 3;

function BrowserTabsSection({
  tabs,
  optimisticPlaying,
  onCommand,
}: {
  tabs: BrowserTab[];
  optimisticPlaying: Record<number, boolean>;
  onCommand: (tab: BrowserTab, action: BrowserTabAction) => void;
}) {
  return (
    <View style={styles.browserSection}>
      <Text style={styles.browserHead}>Browser</Text>
      <ScrollView
        style={tabs.length > BROWSER_MAX_ROWS ? { maxHeight: BROWSER_ROW_HEIGHT * BROWSER_MAX_ROWS } : undefined}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {tabs.map((tab, i) => (
          <BrowserTabRow
            key={`${tab.browser}-${tab.tab_id}`}
            tab={tab}
            playing={optimisticPlaying[tab.tab_id] ?? tab.playing}
            last={i === tabs.length - 1}
            onCommand={(action) => onCommand(tab, action)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function BrowserTabRow({
  tab,
  playing,
  last,
  onCommand,
}: {
  tab: BrowserTab;
  playing: boolean;
  last: boolean;
  onCommand: (action: BrowserTabAction) => void;
}) {
  return (
    <View style={[styles.browserRow, !last && styles.browserRowDivider]}>
      <View style={styles.browserBadge}>
        <Text style={styles.browserBadgeText}>{tab.browser === 'firefox' ? 'F' : 'C'}</Text>
      </View>
      <Text style={styles.browserTitle} numberOfLines={1}>
        {tab.title || 'Untitled tab'}
      </Text>
      <View style={styles.browserActions}>
        <PressableScale
          style={styles.browserBtn}
          onPress={() => onCommand('playpause')}
          accessibilityLabel={playing ? 'Pause tab' : 'Play tab'}
        >
          {playing ? <IconPause size={13} color={colors.off} /> : <IconPlay size={13} color={colors.off} />}
        </PressableScale>
        <PressableScale style={styles.browserBtn} onPress={() => onCommand('focus')} accessibilityLabel="Focus tab">
          <IconArrowUpRight size={13} color={colors.off72} />
        </PressableScale>
        <PressableScale style={styles.browserBtn} onPress={() => onCommand('mute')} accessibilityLabel="Mute tab">
          <IconMute size={13} color={colors.off72} />
        </PressableScale>
      </View>
    </View>
  );
}

/* ------------------------------ timer pill ------------------------------ */

function TimerPill({
  remainingSeconds,
  label = 'sleep timer',
  onPress,
  onCancel,
}: {
  remainingSeconds: number;
  label?: string;
  onPress: () => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState(remainingSeconds);
  useEffect(() => {
    setLocal(remainingSeconds);
    const id = setInterval(() => setLocal((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [remainingSeconds]);

  const fading = local <= 60;

  return (
    <PressableScale
      style={[styles.timerPill, fading && styles.timerPillFading]}
      onPress={onPress}
    >
      <IconSleep size={15} color={colors.green} />
      <Text style={styles.timerPillTime}>{fmtTime(local)}</Text>
      <Text style={[styles.timerPillLabel, fading && styles.timerPillLabelFading]}>
        {fading ? 'fading now' : label}
      </Text>
      <PressableScale style={styles.timerPillClose} onPress={onCancel} accessibilityLabel="Cancel sleep timer">
        <IconX size={11} color={colors.off72} />
      </PressableScale>
    </PressableScale>
  );
}

/* -------------------------------- banners -------------------------------- */

function UpdateBanner({
  version,
  fromVersion,
  phase,
  progress,
  onDownload,
}: {
  version: string;
  fromVersion: string;
  phase: 'idle' | 'downloading';
  progress: number;
  onDownload: () => void;
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerTop}>
        <View style={styles.bannerBadge}>
          <IconDownload size={18} color={colors.green} />
        </View>
        <Text style={styles.bannerTitle}>Update available</Text>
      </View>
      <Text style={styles.bannerSub}>
        macremote {version} is ready, upgrading from {fromVersion}.
      </Text>
      {phase === 'downloading' && (
        <View style={styles.bannerProgressWrap}>
          <View style={[styles.bannerProgressFill, { width: `${progress}%` }]} />
        </View>
      )}
      <View style={styles.bannerRow}>
        <PressableScale style={styles.btnSecondaryAccent} onPress={onDownload} disabled={phase === 'downloading'}>
          <IconDownload size={15} color={colors.greenInk} />
          <Text style={styles.btnSecondaryAccentLabel}>
            {phase === 'downloading' ? 'Downloading…' : 'Download & Install'}
          </Text>
        </PressableScale>
        {phase === 'downloading' && <Text style={styles.progressPct}>{Math.round(progress)}%</Text>}
      </View>
    </View>
  );
}

function OfflineBanner({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <View style={styles.offlineBanner}>
      <View style={styles.offlineIcon}>
        <IconWifiOff size={26} color={colors.ember} />
      </View>
      <Text style={styles.offlineTitle}>Can&apos;t reach your Mac</Text>
      <Text style={styles.offlineBody}>Make sure both devices are awake and on the same network.</Text>
      <PressableScale style={styles.btnSecondaryAccent} onPress={onRetry} disabled={retrying}>
        <IconRefresh size={15} color={colors.greenInk} />
        <Text style={styles.btnSecondaryAccentLabel}>{retrying ? 'Retrying…' : 'Retry'}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink950 },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  conn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    shadowColor: colors.green,
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  connDotOffline: { backgroundColor: colors.ember, shadowColor: colors.ember },
  connLabel: { fontFamily: fonts.semiBold, fontSize: 12.5, color: colors.off72, maxWidth: 140 },
  marquee: { flex: 1, minWidth: 0, height: 20, overflow: 'hidden', justifyContent: 'center' },
  marqueeTrack: { flexDirection: 'row' },
  marqueeText: { fontFamily: fonts.medium, fontSize: 12, color: colors.off55 },
  marqueeIdle: { fontFamily: fonts.medium, fontSize: 12, color: colors.off38 },
  battery: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  batteryPct: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.off55 },

  main: { flex: 1, paddingHorizontal: spacing.screenX, minHeight: 0 },
  inert: { opacity: 0.32 },

  banner: {
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    padding: 16,
    marginTop: 10,
    marginRight: railWidth - spacing.screenX,
  },
  bannerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  bannerBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.green14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontFamily: fonts.extraBold, fontSize: 14.5, color: colors.off },
  bannerSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.off55, lineHeight: 18, marginVertical: 8 },
  bannerProgressWrap: { height: 6, borderRadius: radii.full, backgroundColor: colors.ink700, overflow: 'hidden', marginBottom: 12 },
  bannerProgressFill: { height: '100%', backgroundColor: colors.green, borderRadius: radii.full },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnSecondaryAccent: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  btnSecondaryAccentLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.greenInk },
  progressPct: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.off55, marginLeft: 'auto' },

  offlineBanner: {
    alignItems: 'center',
    marginTop: 22,
    marginRight: railWidth - spacing.screenX,
    paddingTop: 8,
  },
  offlineIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ember16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  offlineTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.off, marginBottom: 8 },
  offlineBody: { fontFamily: fonts.body, fontSize: 13.5, color: colors.off55, textAlign: 'center', maxWidth: 260, marginBottom: 20 },

  npHero: { marginTop: 8, marginRight: railWidth - spacing.screenX },
  npCard: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: 16,
  },
  npArt: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.ink600,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  npBody: { flex: 1, minWidth: 0 },
  npTitle: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.off },
  npArtist: { fontFamily: fonts.body, fontSize: 13.5, color: colors.off55, marginTop: 2 },
  npMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  npAppPill: { backgroundColor: colors.ink700, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full },
  npAppPillText: { fontFamily: fonts.bold, fontSize: 11, color: colors.off55 },
  eqBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 12 },
  eqBar: { width: 2.5, borderRadius: 2, backgroundColor: colors.green },

  // Rail-aware like npHero/banner above it. Max ~3 rows visible (see
  // BROWSER_ROW_HEIGHT/BROWSER_MAX_ROWS); the inner ScrollView only caps
  // height when there are more tabs than that, so a 1-2 tab list never
  // shows a clipped scroll affordance it doesn't need.
  browserSection: {
    marginTop: 10,
    marginRight: railWidth - spacing.screenX,
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
  },
  browserHead: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.off38,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  browserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: BROWSER_ROW_HEIGHT,
  },
  browserRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  browserBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.ink700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browserBadgeText: { fontFamily: fonts.extraBold, fontSize: 10.5, color: colors.off72 },
  browserTitle: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 12.5, color: colors.off },
  browserActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  browserBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink700,
    alignItems: 'center',
    justifyContent: 'center',
  },

  thumbZone: { marginTop: 'auto', alignItems: 'center', paddingRight: 56 },

  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: radii.full,
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 18,
  },
  timerPillFading: { backgroundColor: colors.green14, borderColor: colors.green24 },
  timerPillTime: { fontFamily: fonts.bold, fontSize: 13, color: colors.off },
  timerPillLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.off55 },
  timerPillLabelFading: { color: colors.green },
  timerPillClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink700,
    alignItems: 'center',
    justifyContent: 'center',
  },

  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
  tBtnSide: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.ink850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tBtnPlay: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackToast: {
    position: 'absolute',
    top: -30,
    alignSelf: 'center',
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  trackToastText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.off55 },

  // Compact back/forward-10s row, sized between the 44px secondary buttons
  // and the 66px transport buttons — two 52px circles plus one gap (122px)
  // is well inside the ~268px budget the thumb zone clears past the volume
  // rail at 360px width, so it never crowds the transport above it.
  seekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 16 },
  seekBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ink850,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Five buttons now that cursor-park joined brightness/lock/timer — sized
  // down slightly from the mockup's 50px so the row still clears the volume
  // rail on a 360px-wide phone without wrapping. alignItems is flex-start
  // (not center) because the brightness cluster below can grow one text
  // line taller when a non-builtin target is active; top-aligning keeps
  // every icon at the same y regardless.
  secondaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 10, marginTop: 22 },
  sBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sBtnOn: { backgroundColor: colors.green14 },

  // Brightness down+up stay exactly the width they always were (44+10+44,
  // same footprint the flat five-button row already budgeted for) — the
  // display-chooser badge is absolutely positioned so it never adds to the
  // row's width, and the target-name label only adds height, not width.
  brightCluster: { alignItems: 'center' },
  brightPair: { flexDirection: 'row', gap: 10 },
  brightUpWrap: { position: 'relative' },
  displayBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.ink700,
    borderWidth: 1,
    borderColor: colors.ink950,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brightTargetRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  brightTargetLabel: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: colors.off38,
    marginTop: 4,
    maxWidth: 98,
  },
});
