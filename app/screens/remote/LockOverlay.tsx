// Local "child lock" overlay, ported from deck.html's #lockOverlay: tapping
// Lock in the secondary row both fires the real system lock (POST
// /system/lock, locking the Mac itself) and raises this overlay so a phone
// left face-up doesn't send stray taps — pressing and holding the ring for
// ~2s dismisses it again. It never reaches back out to the Mac; it's purely
// local UI, matching the mockup's "press and hold to unlock" framing.
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, Svg } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from '../../components/PressableScale';
import { IconLock, IconLockPartial } from '../../components/icons';
import { colors, fonts } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const HOLD_MS = 650;

export function LockOverlay({ visible, onUnlock }: { visible: boolean; onUnlock: () => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1.02);
  const progress = useSharedValue(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 350 });
    scale.value = withTiming(visible ? 1 : 1.02, { duration: 350 });
  }, [visible, opacity, scale]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  function startHold() {
    progress.value = withTiming(1, { duration: HOLD_MS });
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      progress.value = 0;
      onUnlock();
    }, HOLD_MS);
  }
  function cancelHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    progress.value = withTiming(0, { duration: 150 });
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.glyph}>
        <IconLock size={30} color={colors.off72} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>macremote is locked</Text>
        <Text style={styles.sub}>Press and hold to unlock</Text>
      </View>
      <PressableScale
        style={styles.unlockBtn}
        onPressIn={startHold}
        onPressOut={cancelHold}
        accessibilityLabel="Hold to unlock"
      >
        <Svg width={84} height={84} viewBox="0 0 84 84" style={StyleSheet.absoluteFill}>
          <Circle cx={42} cy={42} r={RADIUS} fill="none" stroke={colors.ink600} strokeWidth={4} />
          <AnimatedCircle
            cx={42}
            cy={42}
            r={RADIUS}
            fill="none"
            stroke={colors.green}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={ringProps}
            rotation={-90}
            origin="42, 42"
          />
        </Svg>
        <IconLockPartial size={24} color={colors.off} />
      </PressableScale>
      <Text style={styles.hint}>2 seconds</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 15,
    backgroundColor: 'rgba(11,14,18,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  glyph: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.off },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.off55 },
  unlockBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontFamily: fonts.body, fontSize: 11.5, color: colors.off38 },
});
