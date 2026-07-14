// Right-edge vertical volume rail, ported from deck.html's #volRail /
// #volTrack. A single Pan gesture (react-native-gesture-handler) covers the
// whole track: grabbing near the thumb drags absolute volume immediately;
// pressing elsewhere starts a press-and-hold step repeat (+/-6, matching the
// mockup's upper/lower half zones) that converts into an absolute drag the
// moment the touch travels more than the 6px threshold — same rule the
// mockup uses to tell "a real drag" from "a hold-repeat".
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from '../../components/PressableScale';
import { IconMute, IconVolume } from '../../components/icons';
import { colors, durations, easingCurves, fonts, radii } from '../../theme';

const STEP = 6;
const HOLD_REPEAT_MS = 170;
const DRAG_THRESHOLD = 6;
const NETWORK_THROTTLE_MS = 100; // ~10Hz max while dragging

interface VolumeRailProps {
  value: number;
  muted: boolean;
  disabled?: boolean;
  onChangeVolume: (v: number) => void;
  onCommitVolume: (v: number) => void;
  onToggleMute: () => void;
}

export function VolumeRail({
  value,
  muted,
  disabled,
  onChangeVolume,
  onCommitVolume,
  onToggleMute,
}: VolumeRailProps) {
  const displayVolume = useSharedValue(value);
  const labelOpacity = useSharedValue(0);
  const dragging = useSharedValue(false);
  const railHeight = useSharedValue(1);
  const [label, setLabel] = useState(Math.round(value));

  const isDraggingRef = useRef(false);
  const lastSentRef = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const labelHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from the server-driven prop whenever we are not actively dragging.
  useEffect(() => {
    if (isDraggingRef.current) return;
    displayVolume.value = withTiming(value, {
      duration: 280,
      easing: Easing.bezier(...easingCurves.soft),
    });
    setLabel(Math.round(value));
  }, [value, displayVolume]);

  const updateLabel = useCallback((v: number) => setLabel(Math.round(v)), []);

  const sendThrottled = useCallback(
    (v: number) => {
      const now = Date.now();
      if (now - lastSentRef.current < NETWORK_THROTTLE_MS) return;
      lastSentRef.current = now;
      onChangeVolume(v);
    },
    [onChangeVolume]
  );

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const stepStateRef = useRef(0);
  const startHold = useCallback(
    (direction: 1 | -1) => {
      const apply = () => {
        const next = Math.max(0, Math.min(100, stepStateRef.current + direction * STEP));
        stepStateRef.current = next;
        displayVolume.value = withTiming(next, {
          duration: 280,
          easing: Easing.bezier(...easingCurves.soft),
        });
        updateLabel(next);
        onCommitVolume(next);
      };
      stepStateRef.current = displayVolume.value;
      apply();
      clearHold();
      holdTimer.current = setInterval(apply, HOLD_REPEAT_MS);
    },
    [clearHold, displayVolume, onCommitVolume, updateLabel]
  );

  const showLabel = useCallback(() => {
    labelOpacity.value = withTiming(1, { duration: 200 });
    if (labelHideTimer.current) clearTimeout(labelHideTimer.current);
  }, [labelOpacity]);

  const hideLabelSoon = useCallback(
    (delay: number) => {
      if (labelHideTimer.current) clearTimeout(labelHideTimer.current);
      labelHideTimer.current = setTimeout(() => {
        labelOpacity.value = withTiming(0, { duration: 200 });
      }, delay);
    },
    [labelOpacity]
  );

  const beginDrag = useCallback(
    (startingVolume: number) => {
      isDraggingRef.current = true;
      dragging.value = true;
      displayVolume.value = startingVolume;
      updateLabel(startingVolume);
      sendThrottled(startingVolume);
      showLabel();
    },
    [dragging, displayVolume, sendThrottled, showLabel, updateLabel]
  );

  const updateDrag = useCallback(
    (v: number) => {
      displayVolume.value = v;
      updateLabel(v);
      sendThrottled(v);
    },
    [displayVolume, sendThrottled, updateLabel]
  );

  const endDrag = useCallback(
    (finalVolume: number) => {
      isDraggingRef.current = false;
      dragging.value = false;
      onCommitVolume(finalVolume);
      hideLabelSoon(700);
    },
    [dragging, hideLabelSoon, onCommitVolume]
  );

  const startY = useRef(0);
  const holdActive = useRef(false);

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      'worklet';
      const h = railHeight.value;
      const vol = h > 0 ? Math.max(0, Math.min(100, ((h - e.y) / h) * 100)) : displayVolume.value;
      const thumbY = h > 0 ? h - (displayVolume.value / 100) * h : 0;
      const grabbedThumb = Math.abs(e.y - thumbY) < 18;
      runOnJS(showLabel)();
      if (grabbedThumb) {
        runOnJS(beginDrag)(vol);
      } else {
        runOnJS(setStartY)(e.y);
        const direction: 1 | -1 = e.y < h / 2 ? 1 : -1;
        runOnJS(startHold)(direction);
      }
    })
    .onUpdate((e) => {
      'worklet';
      const h = railHeight.value;
      const vol = h > 0 ? Math.max(0, Math.min(100, ((h - e.y) / h) * 100)) : displayVolume.value;
      runOnJS(handleMove)(e.y, vol);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(handleRelease)();
    });

  // Bridges below live in JS (not worklets) — refs/state can't be touched
  // from the UI thread directly, so onBegin/onUpdate/onFinalize call these
  // via runOnJS.
  function setStartY(y: number) {
    startY.current = y;
    holdActive.current = true;
  }
  function handleMove(y: number, vol: number) {
    if (isDraggingRef.current) {
      updateDrag(vol);
      return;
    }
    if (holdActive.current && Math.abs(y - startY.current) > DRAG_THRESHOLD) {
      holdActive.current = false;
      clearHold();
      beginDrag(vol);
    }
  }
  function handleRelease() {
    clearHold();
    holdActive.current = false;
    if (isDraggingRef.current) {
      endDrag(Math.round(displayVolume.value));
    }
  }

  const fillStyle = useAnimatedStyle(() => ({ height: `${displayVolume.value}%` }));
  const thumbStyle = useAnimatedStyle(() => ({ bottom: `${displayVolume.value}%` }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: (1 - labelOpacity.value) * 3 }],
  }));

  return (
    <View style={[styles.rail, disabled && styles.disabled]} pointerEvents={disabled ? 'none' : 'auto'}>
      <Animated.Text style={[styles.value, labelStyle]}>{label}</Animated.Text>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.track}
          onLayout={(e) => {
            railHeight.value = e.nativeEvent.layout.height;
          }}
        >
          <View style={styles.ticks} pointerEvents="none">
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.tick} />
            ))}
          </View>
          <Animated.View style={[styles.fill, fillStyle]} />
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
      <PressableScale
        style={[styles.muteBtn, muted && styles.muteBtnOn]}
        onPress={onToggleMute}
        accessibilityLabel="Mute"
        disabled={disabled}
      >
        {muted ? <IconMute size={19} color={colors.ember} /> : <IconVolume size={19} color={colors.off72} />}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    right: 10,
    top: 74,
    bottom: 18,
    width: 58,
    alignItems: 'center',
  },
  disabled: { opacity: 0.32 },
  value: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.off,
    marginBottom: 10,
  },
  track: {
    flex: 1,
    width: 46,
    borderRadius: radii.full,
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  ticks: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
  },
  tick: { height: 1, marginHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.green,
  },
  thumb: {
    position: 'absolute',
    left: 5,
    right: 5,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.off,
    marginBottom: -2.5,
  },
  muteBtn: {
    marginTop: 12,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.ink850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteBtnOn: { backgroundColor: colors.ember16 },
});
