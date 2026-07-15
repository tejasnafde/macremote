// Dismissable help card for external-display brightness. External monitors
// only accept DDC over the right connection, so when a command is ignored we
// explain that the feature is real but the port/cable combo does not carry it,
// rather than leaving a dead button. Opened automatically the first time a
// display ignores a command, and any time from the "?" icon by the brightness
// controls.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/PressableScale';
import { colors, fonts, radii } from '../../theme';

const TIPS = [
  'Use DisplayPort, not HDMI. On Apple Silicon Macs, DDC brightness works over USB-C or DisplayPort but not over HDMI, including HDMI-to-USB-C cables and adapters.',
  'Connect the monitor’s DisplayPort input to the Mac with a USB-C-to-DisplayPort cable. Avoid anything with HDMI in the path.',
  'In the monitor menu, turn off power-saving and dynamic presets (Smart Energy Saving, auto brightness, local dimming, dynamic gaming modes). These can block DDC.',
  'Built-in laptop brightness always works. This only affects external monitors.',
];

export function DisplayHelpCard({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
        <View style={styles.center} pointerEvents="box-none">
          <View style={[styles.card, { marginTop: insets.top }]}>
            <Text style={styles.title}>External brightness not responding</Text>
            <Text style={styles.lede}>
              This is supposed to work, but your monitor is not accepting brightness commands over its
              current connection. It is almost always the cable or port, not the app.
            </Text>
            {TIPS.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.dot} />
                <Text style={styles.tip}>{tip}</Text>
              </View>
            ))}
            <PressableScale style={styles.btn} onPress={onClose}>
              <Text style={styles.btnText}>Got it</Text>
            </PressableScale>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(6,8,10,0.72)' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: colors.ink900,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    padding: 22,
  },
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.off, marginBottom: 10 },
  lede: { fontFamily: fonts.body, fontSize: 13.5, color: colors.off72, lineHeight: 20, marginBottom: 16 },
  tipRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green, marginTop: 7 },
  tip: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.off55, lineHeight: 19 },
  btn: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.greenInk },
});
