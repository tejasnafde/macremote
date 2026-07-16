import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { colors, fontModules } from './theme';
import { hasAnyDevice } from './lib/devices';
import { ToastProvider } from './components/Toast';
import { AppsScreen } from './screens/AppsScreen';
import { DevicesScreen } from './screens/DevicesScreen';
import { ReadingScreen } from './screens/ReadingScreen';
import { RemoteScreen } from './screens/RemoteScreen';
import { SetupScreen } from './screens/SetupScreen';

type Mode = 'loading' | 'setup' | 'devices' | 'remote' | 'reading' | 'apps';

export default function App() {
  const [fontsLoaded] = useFonts(fontModules);
  const [mode, setMode] = useState<Mode>('loading');
  const [refreshToken, setRefreshToken] = useState(0);

  const bootstrap = useCallback(async () => {
    const has = await hasAnyDevice();
    setMode(has ? 'remote' : 'setup');
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  function goRemote() {
    setRefreshToken((t) => t + 1);
    setMode('remote');
  }

  if (mode === 'loading' || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ToastProvider>
          <View style={styles.root}>
            <StatusBar style="light" />
            {mode === 'setup' && <SetupScreen onDone={goRemote} />}
            {mode === 'devices' && (
              <DevicesScreen onSwitched={goRemote} onAddDevice={() => setMode('setup')} />
            )}
            {mode === 'remote' && (
              <RemoteScreen
                onOpenDevices={() => setMode('devices')}
                onOpenReading={() => setMode('reading')}
                onOpenApps={() => setMode('apps')}
                refreshToken={refreshToken}
              />
            )}
            {mode === 'reading' && <ReadingScreen onClose={() => setMode('remote')} />}
            {mode === 'apps' && <AppsScreen onClose={() => setMode('remote')} />}
          </View>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink950 },
  loading: { flex: 1, backgroundColor: colors.ink950, alignItems: 'center', justifyContent: 'center' },
});
