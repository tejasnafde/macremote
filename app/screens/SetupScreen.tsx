// Setup / Add-device screen, ported from deck.html's #screenSetup: device
// URL + token fields, a show/hide eye toggle on the token field, Test
// Connection (idle -> testing -> success, single-flight guarded), then Save
// adds the device to lib/devices.ts and makes it active.
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/PressableScale';
import { IconCheck, IconEye, IconEyeOff, IconRefresh } from '../components/icons';
import { testConnection } from '../lib/api';
import { addDevice } from '../lib/devices';
import { colors, durations, easingCurves, fonts, radii, spacing } from '../theme';

type TestState = 'idle' | 'testing' | 'success' | 'failed';

export function SetupScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [host, setHost] = useState('');
  const [token, setToken] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [hint, setHint] = useState('');
  const shakeX = useSharedValue(0);
  const savedRef = useRef(false);

  function shake() {
    shakeX.value = withSequence(
      withTiming(-6, { duration: 90 }),
      withTiming(6, { duration: 180 }),
      withTiming(0, { duration: 90 })
    );
  }

  async function handleTest() {
    if (testState === 'testing') return; // single-flight guard
    if (!host.trim() || !token.trim()) {
      setHint('Enter both fields to continue.');
      shake();
      return;
    }
    setHint('');
    setTestState('testing');
    try {
      await testConnection(host, token);
      setTestState('success');
      savedRef.current = false;
      setTimeout(() => finishSetup(), 1100);
    } catch (err) {
      setTestState('idle');
      setHint(err instanceof Error ? err.message : 'Could not reach that address.');
      shake();
    }
  }

  async function finishSetup() {
    if (savedRef.current) return;
    savedRef.current = true;
    await addDevice({ url: host, token });
    onDone();
  }

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <Text style={styles.wordmark}>
        mac<Text style={styles.wordmarkAccent}>remote</Text>
      </Text>
      <View style={styles.head}>
        <Text style={styles.h1}>Add a device</Text>
        <Text style={styles.sub}>
          Connect a Mac you want to control from your pocket. It shows up in My Devices once
          linked.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Server address</Text>
        <TextInput
          style={styles.input}
          value={host}
          onChangeText={setHost}
          placeholder="e.g. 192.168.1.42:5150"
          placeholderTextColor={colors.off38}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>

      <Animated.View style={[styles.field, shakeStyle]}>
        <Text style={styles.label}>Access token</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, styles.inputWithEye]}
            value={token}
            onChangeText={setToken}
            placeholder="Paste the token from your Mac"
            placeholderTextColor={colors.off38}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!tokenVisible}
          />
          <PressableScale
            style={styles.eyeBtn}
            onPress={() => setTokenVisible((v) => !v)}
            accessibilityLabel={tokenVisible ? 'Hide token' : 'Show token'}
          >
            {tokenVisible ? <IconEyeOff /> : <IconEye />}
          </PressableScale>
        </View>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </Animated.View>

      <View style={styles.actions}>
        <PressableScale
          style={[styles.primaryBtn, testState === 'testing' && styles.primaryBtnLoading]}
          onPress={handleTest}
          disabled={testState === 'testing'}
        >
          {testState === 'testing' ? (
            <ActivityIndicator color={colors.off72} />
          ) : testState === 'success' ? (
            <IconCheck />
          ) : (
            <IconRefresh />
          )}
          <Text style={styles.primaryBtnLabel}>
            {testState === 'testing'
              ? 'Testing…'
              : testState === 'success'
                ? 'Connected'
                : 'Test Connection'}
          </Text>
        </PressableScale>

        {testState === 'success' && (
          <View style={styles.successNote}>
            <Text style={styles.successNoteText}>Connected. Redirecting.</Text>
            <PressableScale onPress={finishSetup}>
              <Text style={styles.successLink}>Continue</Text>
            </PressableScale>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink950, paddingHorizontal: spacing.setupX },
  wordmark: { fontFamily: fonts.display, fontSize: 20, color: colors.off, marginBottom: 44 },
  wordmarkAccent: { color: colors.green },
  head: { marginBottom: 36 },
  h1: { fontFamily: fonts.display, fontSize: 28, color: colors.off, marginBottom: 10 },
  sub: { fontFamily: fonts.body, fontSize: 14.5, color: colors.off55, lineHeight: 21, maxWidth: 300 },
  field: { marginBottom: 18 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.off55,
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.off,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: 16,
  },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  inputWithEye: { paddingRight: 58 },
  eyeBtn: {
    position: 'absolute',
    right: 4,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, fontFamily: fonts.body, color: colors.ember, marginTop: 7 },
  actions: { marginTop: 12 },
  primaryBtn: {
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnLoading: { backgroundColor: colors.ink700 },
  primaryBtnLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.greenInk },
  successNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  successNoteText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.off55 },
  successLink: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green, marginLeft: 'auto' },
});
