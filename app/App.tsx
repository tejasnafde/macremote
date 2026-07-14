import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { checkForUpdate, downloadAndInstall } from './lib/apk';
import { theme } from './lib/theme';
import { RemoteScreen } from './screens/RemoteScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Tab = 'remote' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('remote');

  // Throttled (1/day) launch check for a newer APK on GitHub Releases; a
  // manual "Check for update" button in Settings bypasses the throttle.
  useEffect(() => {
    checkForUpdate(false).then((latest) => {
      if (!latest) return;
      Alert.alert(
        `macremote v${latest.version} available`,
        'Download and install the update now?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Update',
            onPress: () => {
              downloadAndInstall(latest.apkUrl).catch((err) => {
                Alert.alert('Update failed', err instanceof Error ? err.message : 'Unknown error');
              });
            },
          },
        ]
      );
    });
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>macremote</Text>
      </View>
      <View style={styles.body}>{tab === 'remote' ? <RemoteScreen /> : <SettingsScreen />}</View>
      <View style={styles.tabBar}>
        <TabButton label="Remote" active={tab === 'remote'} onPress={() => setTab('remote')} />
        <TabButton label="Settings" active={tab === 'settings'} onPress={() => setTab('settings')} />
      </View>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: { color: theme.text, fontSize: 20, fontWeight: '700' },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingBottom: 20,
    paddingTop: 8,
    backgroundColor: theme.surface,
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabLabel: { color: theme.textMuted, fontSize: 14, fontWeight: '600' },
  tabLabelActive: { color: theme.accent },
});
