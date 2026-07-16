// Reading pad: a full-screen trackpad-like surface for scrolling and turning
// pages in whatever app is frontmost on the Mac (browser manga, Readest, PDFs).
// One react-native-gesture-handler surface carries both gestures: a vertical
// Pan drives /input/scroll (throttled ~18Hz, sub-pixel remainder accumulated
// exactly like VolumeRail's sendThrottled), and a Tap on the left/right third
// turns the page via /input/key. Nothing here polls /status; scroll errors
// stay silent so a dropped packet mid-drag never interrupts reading.
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/PressableScale';
import { IconArrowLeft, IconChevronLeft, IconChevronRight } from '../components/icons';
import { api, NavKey } from '../lib/api';
import { getReadingPageMode, ReadingPageMode, setReadingPageMode } from '../lib/settings';
import { colors, fonts, radii, spacing } from '../theme';

// ~18Hz network cap while dragging, matching VolumeRail's throttle intent.
const NETWORK_THROTTLE_MS = 55;
// Pixels of Mac scroll per pixel of finger travel. Slightly amplified so a
// short thumb drag clears a page without feeling twitchy.
const SCROLL_GAIN = 1.6;
// Sign convention: dragging the finger UP advances the page (content scrolls
// up, revealing what comes next), the natural "push the page up to read on"
// feel. Finger-up is a negative translationY delta, so we negate it into a
// positive dy; positive dy = advance. Flip this one constant if a given Mac's
// scroll direction is inverted.
const ADVANCE_SIGN = -1;

function keyForTurn(dir: 'prev' | 'next', mode: ReadingPageMode): NavKey {
  if (mode === 'space') return dir === 'next' ? 'space' : 'pageup';
  return dir === 'next' ? 'right' : 'left';
}

export function ReadingScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [pageMode, setPageMode] = useState<ReadingPageMode>('arrows');
  // Worklets read the current mode through a ref so a tap never fires a stale
  // key right after the toggle flips.
  const pageModeRef = useRef<ReadingPageMode>('arrows');

  useEffect(() => {
    getReadingPageMode().then((m) => {
      setPageMode(m);
      pageModeRef.current = m;
    });
  }, []);

  const surfaceWidth = useSharedValue(1);
  const leftFlash = useSharedValue(0);
  const rightFlash = useSharedValue(0);

  // Drag bookkeeping lives in refs (JS thread); the gesture worklets bridge
  // into these via runOnJS, the same split VolumeRail uses.
  const lastTranslationRef = useRef(0);
  const accumRef = useRef(0);
  const lastSentRef = useRef(0);

  const flush = useCallback((force: boolean) => {
    const whole = force ? Math.round(accumRef.current) : Math.trunc(accumRef.current);
    if (whole === 0) return;
    accumRef.current -= whole;
    lastSentRef.current = Date.now();
    api.inputScroll(0, whole).catch(() => undefined);
  }, []);

  const beginScroll = useCallback(() => {
    lastTranslationRef.current = 0;
    accumRef.current = 0;
    lastSentRef.current = 0;
  }, []);

  const updateScroll = useCallback(
    (translationY: number) => {
      const frameDelta = translationY - lastTranslationRef.current;
      lastTranslationRef.current = translationY;
      accumRef.current += ADVANCE_SIGN * frameDelta * SCROLL_GAIN;
      if (Date.now() - lastSentRef.current >= NETWORK_THROTTLE_MS) flush(false);
    },
    [flush]
  );

  const endScroll = useCallback(() => {
    flush(true);
    accumRef.current = 0;
    lastTranslationRef.current = 0;
  }, [flush]);

  const handleTurn = useCallback((dir: 'prev' | 'next') => {
    api.inputKey(keyForTurn(dir, pageModeRef.current)).catch(() => undefined);
  }, []);

  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      'worklet';
      runOnJS(beginScroll)();
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(updateScroll)(e.translationY);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(endScroll)();
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .maxDistance(12)
    .onEnd((e, success) => {
      'worklet';
      if (!success) return;
      const w = surfaceWidth.value;
      if (e.x < w / 3) {
        leftFlash.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 260 }));
        runOnJS(handleTurn)('prev');
      } else if (e.x > (w * 2) / 3) {
        rightFlash.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 260 }));
        runOnJS(handleTurn)('next');
      }
    });

  const composed = Gesture.Race(pan, tap);

  const leftFlashStyle = useAnimatedStyle(() => ({ opacity: leftFlash.value * 0.12 }));
  const rightFlashStyle = useAnimatedStyle(() => ({ opacity: rightFlash.value * 0.12 }));

  async function handleToggleMode(next: ReadingPageMode) {
    setPageMode(next);
    pageModeRef.current = next;
    await setReadingPageMode(next);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { paddingLeft: insets.left + spacing.screenX, paddingRight: insets.right + spacing.screenX }]}>
        <PressableScale style={styles.backBtn} onPress={onClose} accessibilityLabel="Back to remote">
          <IconArrowLeft size={20} color={colors.off72} />
        </PressableScale>
        <Text style={styles.headTitle}>Reading</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.surfaceWrap, { marginLeft: insets.left + spacing.screenX, marginRight: insets.right + spacing.screenX }]}>
        <GestureDetector gesture={composed}>
          <View
            style={styles.surface}
            onLayout={(e) => {
              surfaceWidth.value = e.nativeEvent.layout.width;
            }}
          >
            <View style={styles.dividers} pointerEvents="none">
              <View style={styles.divider} />
              <View style={styles.divider} />
            </View>

            <Animated.View style={[styles.flashLeft, leftFlashStyle]} pointerEvents="none" />
            <Animated.View style={[styles.flashRight, rightFlashStyle]} pointerEvents="none" />

            <View style={styles.affordances} pointerEvents="none">
              <View style={styles.affSide}>
                <IconChevronLeft size={26} color={colors.off18} />
                <Text style={styles.affLabel}>prev</Text>
              </View>
              <View style={styles.affCenter}>
                <Text style={styles.hint}>Drag up to read on</Text>
                <Text style={styles.hintSub}>Tap a side to turn the page</Text>
              </View>
              <View style={styles.affSide}>
                <IconChevronRight size={26} color={colors.off18} />
                <Text style={styles.affLabel}>next</Text>
              </View>
            </View>
          </View>
        </GestureDetector>
      </View>

      <View style={[styles.controls, { paddingLeft: insets.left + spacing.screenX, paddingRight: insets.right + spacing.screenX }]}>
        <PressableScale style={styles.turnBtn} onPress={() => handleTurn('prev')} accessibilityLabel="Previous page">
          <IconChevronLeft size={22} color={colors.off} />
        </PressableScale>

        <View style={styles.segment}>
          <PressableScale
            style={[styles.segItem, pageMode === 'arrows' && styles.segItemOn]}
            onPress={() => handleToggleMode('arrows')}
          >
            <Text style={[styles.segText, pageMode === 'arrows' && styles.segTextOn]}>Arrows</Text>
          </PressableScale>
          <PressableScale
            style={[styles.segItem, pageMode === 'space' && styles.segItemOn]}
            onPress={() => handleToggleMode('space')}
          >
            <Text style={[styles.segText, pageMode === 'space' && styles.segTextOn]}>Space / Page</Text>
          </PressableScale>
        </View>

        <PressableScale style={styles.turnBtn} onPress={() => handleTurn('next')} accessibilityLabel="Next page">
          <IconChevronRight size={22} color={colors.off} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink950 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.off },

  surfaceWrap: { flex: 1, marginBottom: 14 },
  surface: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.ink900,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  dividers: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  divider: { width: 1, backgroundColor: colors.off18, marginLeft: '33.3%' },
  flashLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '33.3%', backgroundColor: colors.off },
  flashRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '33.3%', backgroundColor: colors.off },
  affordances: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  affSide: { width: 56, alignItems: 'center', gap: 6 },
  affLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.off18,
  },
  affCenter: { flex: 1, alignItems: 'center', gap: 6 },
  hint: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.off38 },
  hintSub: { fontFamily: fonts.body, fontSize: 12, color: colors.off18 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  turnBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: 3,
    gap: 3,
  },
  segItem: { flex: 1, height: 40, borderRadius: radii.sm - 3, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: colors.green14, borderWidth: 1, borderColor: colors.green24 },
  segText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.off55 },
  segTextOn: { color: colors.green },
});
