import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ButtonRow, RemoteButton } from '../components/RemoteButton';
import { api, ApiError, StatusResponse } from '../lib/api';
import { hasServerConfig } from '../lib/storage';
import { theme } from '../lib/theme';

const POLL_MS = 3000;
const TIMER_CHOICES = [15, 30, 45, 60];

export function RemoteScreen() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [online, setOnline] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmSleep, setConfirmSleep] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!(await hasServerConfig())) {
      setConfigured(false);
      return;
    }
    setConfigured(true);
    try {
      const s = await api.status();
      setStatus(s);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

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
      if (next === 'active' && appState !== 'active') {
        startPolling();
      } else if (next !== 'active') {
        stopPolling();
      }
      appState = next;
    });

    return () => {
      stopPolling();
      sub.remove();
    };
  }, [refreshStatus]);

  async function run(name: string, action: () => Promise<void>) {
    setBusy(name);
    try {
      await action();
      await refreshStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong';
      Alert.alert('Action failed', message);
    } finally {
      setBusy(null);
    }
  }

  function confirmAndSleep() {
    Alert.alert('Sleep the Mac?', 'This will put the Mac to sleep now.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sleep', style: 'destructive', onPress: () => run('sleep', api.sleep) },
    ]);
  }

  if (!configured) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyTitle}>Not set up yet</Text>
        <Text style={styles.emptyBody}>
          Head to Settings and enter your server URL and token to start controlling your Mac.
        </Text>
      </View>
    );
  }

  const npState = status?.now_playing?.state?.toLowerCase() ?? null;
  const isPlaying = npState ? npState.includes('play') : Boolean(status?.now_playing?.title);
  const timerRemaining = status?.sleep_timer?.remaining_seconds ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!online && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Can&apos;t reach the server</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.nowPlayingApp}>{status?.now_playing?.app ?? 'Nothing playing'}</Text>
        <Text style={styles.nowPlayingTitle} numberOfLines={1}>
          {status?.now_playing?.title ?? '—'}
        </Text>
        <Text style={styles.nowPlayingArtist} numberOfLines={1}>
          {status?.now_playing?.artist ?? ''}
        </Text>
      </View>

      <Section title="Media">
        <ButtonRow>
          <RemoteButton label="⏮" onPress={() => run('previous', api.previous)} loading={busy === 'previous'} />
          <RemoteButton
            label={isPlaying ? '⏸' : '▶️'}
            onPress={() => run('playpause', api.playPause)}
            loading={busy === 'playpause'}
            variant="primary"
            size="large"
          />
          <RemoteButton label="⏭" onPress={() => run('next', api.next)} loading={busy === 'next'} />
        </ButtonRow>
      </Section>

      <Section title="Volume">
        <ButtonRow>
          <RemoteButton label="🔉" onPress={() => run('vol-down', api.volumeDown)} loading={busy === 'vol-down'} />
          <RemoteButton
            label={status?.muted ? '🔇' : '🔊'}
            onPress={() => run('mute', api.volumeMute)}
            loading={busy === 'mute'}
            variant={status?.muted ? 'danger' : 'default'}
          />
          <RemoteButton label="🔊+" onPress={() => run('vol-up', api.volumeUp)} loading={busy === 'vol-up'} />
        </ButtonRow>
        {status && (
          <Text style={styles.meta}>
            Volume {status.volume}%{status.muted ? ' (muted)' : ''}
          </Text>
        )}
      </Section>

      <Section title="Brightness">
        <ButtonRow>
          <RemoteButton label="🔅" onPress={() => run('bright-down', api.brightnessDown)} loading={busy === 'bright-down'} />
          <RemoteButton label="🔆" onPress={() => run('bright-up', api.brightnessUp)} loading={busy === 'bright-up'} />
        </ButtonRow>
        {status && <Text style={styles.meta}>Brightness {status.brightness}%</Text>}
      </Section>

      <Section title="System">
        <ButtonRow>
          <RemoteButton label="Lock" onPress={() => run('lock', api.lock)} loading={busy === 'lock'} />
          <RemoteButton label="Sleep" variant="danger" onPress={confirmAndSleep} loading={busy === 'sleep'} />
        </ButtonRow>
      </Section>

      <Section title="Sleep timer">
        {timerRemaining > 0 ? (
          <>
            <Text style={styles.timerCountdown}>{formatRemaining(timerRemaining)}</Text>
            <RemoteButton
              label="Cancel timer"
              variant="danger"
              onPress={() => run('cancel-timer', api.cancelSleepTimer)}
              loading={busy === 'cancel-timer'}
            />
          </>
        ) : (
          <ButtonRow>
            {TIMER_CHOICES.map((m) => (
              <RemoteButton
                key={m}
                label={`${m}m`}
                onPress={() => run(`timer-${m}`, () => api.setSleepTimer(m))}
                loading={busy === `timer-${m}`}
              />
            ))}
          </ButtonRow>
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function formatRemaining(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')} remaining`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  offlineBanner: {
    backgroundColor: theme.warning,
    borderRadius: 10,
    padding: 10,
  },
  offlineText: { color: '#1a1400', fontWeight: '700', textAlign: 'center' },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  nowPlayingApp: { color: theme.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  nowPlayingTitle: { color: theme.text, fontSize: 20, fontWeight: '700', marginTop: 4 },
  nowPlayingArtist: { color: theme.textMuted, fontSize: 15, marginTop: 2 },
  section: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionTitle: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  meta: { color: theme.textMuted, fontSize: 13 },
  timerCountdown: { color: theme.accent, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  emptyTitle: { color: theme.text, fontSize: 20, fontWeight: '700' },
  emptyBody: { color: theme.textMuted, fontSize: 15, textAlign: 'center' },
});
