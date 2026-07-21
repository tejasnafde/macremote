// Compact horizontal 0-100 slider shared by the per-app audio rows on
// AppsScreen and the expandable browser-tab volume row on RemoteScreen.
// Same throttled-send pattern as remote/VolumeRail: the local value is
// optimistic while dragging, sends are capped at ~10Hz, a final commit fires
// on release, and the server-driven `value` prop only re-syncs the position
// while the finger is up. Horizontal pans win the gesture; vertical movement
// fails fast so the surrounding ScrollView keeps scrolling naturally.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors, fonts, radii } from '../theme';

const NETWORK_THROTTLE_MS = 100; // ~10Hz max while dragging
const TRACK_HEIGHT = 5;
const THUMB_SIZE = 14;

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

interface HSliderProps {
  /** Server-truth value 0-100; ignored while a drag is in flight. */
  value: number;
  disabled?: boolean;
  /** Throttled to ~10Hz during a drag; failures should be silent. */
  onSend: (v: number) => void;
  /** Final value on release (or tap); the place to surface errors. */
  onCommit: (v: number) => void;
  /** Renders a fixed-width percent readout right of the track. */
  showValue?: boolean;
  accessibilityLabel?: string;
}

export function HSlider({
  value,
  disabled,
  onSend,
  onCommit,
  showValue,
  accessibilityLabel,
}: HSliderProps) {
  const [local, setLocal] = useState(clamp(value));
  const localRef = useRef(clamp(value));
  const draggingRef = useRef(false);
  const trackWidthRef = useRef(1);
  const lastSentRef = useRef(0);

  // Sync from the server-driven prop whenever we are not actively dragging.
  useEffect(() => {
    if (draggingRef.current) return;
    setLocal(clamp(value));
    localRef.current = clamp(value);
  }, [value]);

  function pctFromX(x: number): number {
    const w = trackWidthRef.current;
    return w > 0 ? clamp((x / w) * 100) : localRef.current;
  }

  function setValue(v: number) {
    localRef.current = v;
    setLocal(v);
  }

  function sendThrottled(v: number) {
    const now = Date.now();
    if (now - lastSentRef.current < NETWORK_THROTTLE_MS) return;
    lastSentRef.current = now;
    onSend(v);
  }

  // JS bridges for the worklet callbacks below (refs/state cannot be touched
  // from the UI thread directly).
  function handleBegin(x: number) {
    draggingRef.current = true;
    const v = pctFromX(x);
    setValue(v);
    sendThrottled(v);
  }
  function handleMove(x: number) {
    if (!draggingRef.current) return;
    const v = pctFromX(x);
    setValue(v);
    sendThrottled(v);
  }
  function handleEnd() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onCommit(localRef.current);
  }
  function handleTap(x: number) {
    const v = pctFromX(x);
    setValue(v);
    onCommit(v);
  }

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((e) => {
      'worklet';
      runOnJS(handleBegin)(e.x);
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(handleMove)(e.x);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(handleEnd)();
    });

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd((e, success) => {
      'worklet';
      if (success) runOnJS(handleTap)(e.x);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <View style={[styles.root, disabled && styles.disabled]}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.hitArea}
          accessibilityLabel={accessibilityLabel}
          onLayout={(e) => {
            trackWidthRef.current = e.nativeEvent.layout.width;
          }}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${local}%` }]} />
          </View>
          <View style={[styles.thumb, { left: `${local}%` }]} pointerEvents="none" />
        </View>
      </GestureDetector>
      {showValue && <Text style={styles.readout}>{local}%</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.32 },
  hitArea: { flex: 1, minWidth: 0, height: 32, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: colors.ink700,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.green, borderRadius: radii.full },
  thumb: {
    position: 'absolute',
    top: (32 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    marginLeft: -THUMB_SIZE / 2,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.off,
  },
  // Fixed width so "5%" vs "100%" never makes the track width jitter mid-drag.
  readout: {
    width: 38,
    textAlign: 'right',
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: colors.off55,
  },
});
