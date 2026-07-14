import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RemoteButton } from '../components/RemoteButton';
import { checkForUpdate, downloadAndInstall } from '../lib/apk';
import { api, ApiError } from '../lib/api';
import { getServerConfig, setServerConfig } from '../lib/storage';
import { theme } from '../lib/theme';

type ConnectionState = 'idle' | 'testing' | 'ok' | 'failed';
type UpdateState = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'error';

export function SettingsScreen() {
  const [serverUrl, setServerUrlState] = useState('');
  const [token, setTokenState] = useState('');
  const [saved, setSaved] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [latestApkUrl, setLatestApkUrl] = useState<string | null>(null);

  useEffect(() => {
    getServerConfig().then((cfg) => {
      setServerUrlState(cfg.serverUrl);
      setTokenState(cfg.token);
    });
  }, []);

  async function save() {
    await setServerConfig({ serverUrl, token });
    setSaved(true);
    setConnection('idle');
    setTimeout(() => setSaved(false), 1500);
  }

  async function testConnection() {
    if (connection === 'testing') return; // single-flight: rapid taps otherwise queue overlapping tests
    setConnection('testing');
    setConnectionMessage('');
    await setServerConfig({ serverUrl, token });
    try {
      await api.health();
      await api.status();
      setConnection('ok');
      setConnectionMessage('Connected — health and status both responded.');
    } catch (err) {
      setConnection('failed');
      setConnectionMessage(err instanceof ApiError ? err.message : 'Could not reach the server.');
    }
  }

  async function manualUpdateCheck() {
    if (updateState === 'checking') return;
    setUpdateState('checking');
    const latest = await checkForUpdate(true);
    if (!latest) {
      setUpdateState('up-to-date');
      return;
    }
    setLatestVersion(latest.version);
    setLatestApkUrl(latest.apkUrl);
    setUpdateState('available');
  }

  async function installUpdate() {
    if (!latestApkUrl) return;
    setUpdateState('downloading');
    try {
      await downloadAndInstall(latestApkUrl);
      setUpdateState('idle');
    } catch (err) {
      setUpdateState('error');
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  const appVersion = Constants.expoConfig?.version ?? 'unknown';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Server">
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrlState}
          placeholder="http://100.x.x.x:8484"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.label}>API token</Text>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setTokenState}
          placeholder="bearer token"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <RemoteButton label={saved ? 'Saved' : 'Save'} onPress={save} variant="primary" />
        <RemoteButton
          label="Test connection"
          onPress={testConnection}
          loading={connection === 'testing'}
        />
        {connection === 'ok' && <Text style={styles.success}>{connectionMessage}</Text>}
        {connection === 'failed' && <Text style={styles.error}>{connectionMessage}</Text>}
      </Section>

      <Section title="About">
        <Text style={styles.meta}>Version {appVersion}</Text>
        <Text style={styles.meta}>Platform {Platform.OS}</Text>
        <RemoteButton
          label={updateState === 'checking' ? 'Checking…' : 'Check for update'}
          onPress={manualUpdateCheck}
          loading={updateState === 'checking'}
        />
        {updateState === 'up-to-date' && <Text style={styles.meta}>You&apos;re up to date.</Text>}
        {updateState === 'available' && latestVersion && (
          <View style={styles.updateBox}>
            <Text style={styles.success}>Update available: v{latestVersion}</Text>
            <RemoteButton label="Download and install" onPress={installUpdate} variant="primary" />
          </View>
        )}
        {updateState === 'downloading' && (
          <View style={styles.updateBox}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.meta}>Downloading update…</Text>
          </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
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
  label: { color: theme.textMuted, fontSize: 13 },
  input: {
    backgroundColor: theme.surfaceAlt,
    color: theme.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  meta: { color: theme.textMuted, fontSize: 13 },
  success: { color: theme.success, fontSize: 13 },
  error: { color: theme.danger, fontSize: 13 },
  updateBox: { gap: 8 },
});
