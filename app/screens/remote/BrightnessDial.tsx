// Radial brightness dial, the native successor to the brightness up/down step
// buttons. Interaction + craft ported from design/mockups/dial-radial.html but
// built as proper native components: a react-native-svg 290deg sweep arc with a
// green progress fill and tick marks, an atan2 pointer drag (same throttled
// optimistic-send pattern as VolumeRail), and a center that swaps the active
// display. No emoji, no glyph fonts, no icons standing in for text.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { PressableScale } from '../../components/PressableScale';
import { useToast } from '../../components/Toast';
import { api, Display } from '../../lib/api';
import { colors, easingCurves, fonts } from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Geometry lifted 1:1 from the mockup so the arc reads identically. The SVG is
// drawn in a fixed 300x300 viewBox and scaled to whatever `size` the layout
// hands us, so every constant below is in viewBox units.
const VB = 300;
const CX = 150;
const CY = 150;
const SWEEP_START = 215; // compass degrees where the 0% end of the arc sits
const SWEEP_TOTAL = 290; // degrees of travel for 0..100
const TRACK_R = 118;
const STROKE = 12;
const TICK_COUNT = 40;
const TICK_R_IN = 96;
const TICK_R_OUT_MIN = 108;
const TICK_R_OUT_MAJ = 114;

const NETWORK_THROTTLE_MS = 100; // ~10Hz max while dragging
// Fall back to the sheet past this many displays: a radial bloom of chips gets
// cramped against the volume rail at 360px once there are four screens.
const BLOOM_MAX = 3;

function polarX(r: number, deg: number): number {
  'worklet';
  return CX + r * Math.sin((deg * Math.PI) / 180);
}
function polarY(r: number, deg: number): number {
  'worklet';
  return CY - r * Math.cos((deg * Math.PI) / 180);
}

function arcPath(r: number, startDeg: number, sweepDeg: number): string {
  'worklet';
  if (sweepDeg <= 0.0001) return '';
  const s = Math.min(sweepDeg, 359.9);
  const x1 = polarX(r, startDeg);
  const y1 = polarY(r, startDeg);
  const x2 = polarX(r, startDeg + s);
  const y2 = polarY(r, startDeg + s);
  const large = s > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const TRACK_D = arcPath(TRACK_R, SWEEP_START, SWEEP_TOTAL);

/** builtin -> brightness; external -> gamma_level, or brightness when the
 *  monitor is on real DDC and reports it. Defaults to full when unknown so a
 *  probe that returned null never reads as a dead-dark screen. */
export function displayLevel(d: Display): number {
  if (d.builtin) return d.brightness ?? 100;
  if (d.method === 'ddc' && d.brightness != null) return d.brightness;
  return d.gamma_level ?? d.brightness ?? 100;
}

interface BrightnessDialProps {
  size?: number;
  displays: Display[];
  /** null = no explicit choice yet; the built-in display is treated as active. */
  selectedId: string | null;
  deviceName: string;
  /** builtin brightness from /status, used only when /displays came back empty. */
  fallbackBrightness: number | null;
  disabled?: boolean;
  onSelectDisplay: (id: string) => void;
  /** Opens the full DisplayChooser sheet (used past BLOOM_MAX displays). */
  onOpenChooser: () => void;
}

export function BrightnessDial({
  size = 128,
  displays,
  selectedId,
  deviceName,
  fallbackBrightness,
  disabled,
  onSelectDisplay,
  onOpenChooser,
}: BrightnessDialProps) {
  // When /displays failed or predates multi-display, synthesise the builtin
  // from /status so the dial always has exactly one screen to drive.
  const effective: Display[] = useMemo(
    () =>
      displays.length > 0
        ? displays
        : [{ id: 'builtin', name: deviceName || 'Built-in', builtin: true, brightness: fallbackBrightness, method: 'ddc' }],
    [displays, deviceName, fallbackBrightness]
  );

  const activeId =
    selectedId && effective.some((d) => d.id === selectedId)
      ? selectedId
      : effective.find((d) => d.builtin)?.id ?? effective[0].id;
  const activeDisplay = effective.find((d) => d.id === activeId) ?? effective[0];

  // Per-display working levels: seeded from the probe, then owned locally as the
  // user drags (the dial never re-fetches /displays, matching the mockup).
  const [levels, setLevels] = useState<Record<string, number>>({});
  useEffect(() => {
    setLevels((prev) => {
      const next = { ...prev };
      for (const d of effective) if (next[d.id] == null) next[d.id] = Math.round(displayLevel(d));
      return next;
    });
  }, [effective]);

  // Displays confirmed as software-dimmed by a live via:'gamma' response,
  // layered over the (stale) method the probe reported.
  const [softwareIds, setSoftwareIds] = useState<Record<string, boolean>>({});
  const isSoftware = softwareIds[activeId] ?? activeDisplay.method === 'gamma';

  const toast = useToast();
  const [bloomOpen, setBloomOpen] = useState(false);
  const multi = effective.length > 1;

  const displayValue = useSharedValue(Math.round(displayLevel(activeDisplay)));
  const [label, setLabel] = useState(Math.round(displayLevel(activeDisplay)));
  const isDragging = useRef(false);
  const lastSentRef = useRef(0);
  const gammaToastShownRef = useRef(false);

  // Sync the ring to the active display's stored level whenever it changes and
  // we are not mid-drag: this is what animates the sweep on a screen switch.
  const targetLevel = levels[activeId] ?? Math.round(displayLevel(activeDisplay));
  useEffect(() => {
    if (isDragging.current) return;
    displayValue.value = withTiming(targetLevel, {
      duration: 520,
      easing: Easing.bezier(...easingCurves.soft),
    });
    setLabel(targetLevel);
  }, [activeId, targetLevel, displayValue]);

  const commit = useCallback(
    async (id: string, level: number) => {
      try {
        const res = await api.setBrightness(level, id);
        if (res?.via === 'gamma') {
          setSoftwareIds((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
          if (!gammaToastShownRef.current) {
            gammaToastShownRef.current = true;
            toast.show('Dimming in software (DDC unavailable)', 2400);
          }
        } else if (res?.via === 'ddc') {
          setSoftwareIds((prev) => (prev[id] ? { ...prev, [id]: false } : prev));
        }
      } catch {
        // The next commit (or the drag's final commit) retries; nothing to show.
      }
    },
    [toast]
  );

  const sendThrottled = useCallback(
    (id: string, level: number) => {
      const now = Date.now();
      if (now - lastSentRef.current < NETWORK_THROTTLE_MS) return;
      lastSentRef.current = now;
      api.setBrightness(level, id).catch(() => undefined);
    },
    []
  );

  // JS bridges called from the gesture worklets (refs/state are off-limits on
  // the UI thread), same split as VolumeRail.
  const beginDrag = useCallback(
    (v: number) => {
      if (bloomOpen) setBloomOpen(false);
      isDragging.current = true;
      displayValue.value = v;
      setLabel(Math.round(v));
      sendThrottled(activeId, Math.round(v));
    },
    [activeId, bloomOpen, displayValue, sendThrottled]
  );
  const updateDrag = useCallback(
    (v: number) => {
      displayValue.value = v;
      setLabel(Math.round(v));
      sendThrottled(activeId, Math.round(v));
    },
    [activeId, displayValue, sendThrottled]
  );
  const endDrag = useCallback(() => {
    isDragging.current = false;
    const v = Math.round(displayValue.value);
    setLevels((prev) => ({ ...prev, [activeId]: v }));
    commit(activeId, v);
  }, [activeId, commit, displayValue]);

  // atan2 pointer -> 0..100, clamped, snapping the dead zone past the arc's end
  // to whichever terminus is nearer (mockup's compassToValue).
  const valueFromPoint = useCallback(
    (x: number, y: number) => {
      'worklet';
      const dx = x - size / 2;
      const dy = y - size / 2;
      const compass = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
      const swept = (compass - SWEEP_START + 360) % 360;
      if (swept <= SWEEP_TOTAL) return Math.max(0, Math.min(100, (swept / SWEEP_TOTAL) * 100));
      return swept - SWEEP_TOTAL < 360 - swept ? 100 : 0;
    },
    [size]
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      'worklet';
      runOnJS(beginDrag)(valueFromPoint(e.x, e.y));
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(updateDrag)(valueFromPoint(e.x, e.y));
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(endDrag)();
    });

  function handleCenterPress() {
    if (!multi) return;
    if (effective.length <= BLOOM_MAX) setBloomOpen((o) => !o);
    else onOpenChooser();
  }

  function handleChipSelect(id: string) {
    setBloomOpen(false);
    if (id !== activeId) onSelectDisplay(id);
  }

  const fillProps = useAnimatedProps(() => ({
    d: arcPath(TRACK_R, SWEEP_START, (displayValue.value / 100) * SWEEP_TOTAL),
  }));

  // Ticks are static geometry; the "lit" set is derived from the integer label
  // so they only re-render when the rounded value actually changes.
  const tickGeom = useMemo(() => {
    const arr: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    for (let i = 0; i < TICK_COUNT; i++) {
      const deg = SWEEP_START + i * (SWEEP_TOTAL / (TICK_COUNT - 1));
      const major = i % 5 === 0;
      const rOut = major ? TICK_R_OUT_MAJ : TICK_R_OUT_MIN;
      arr.push({ x1: polarX(TICK_R_IN, deg), y1: polarY(TICK_R_IN, deg), x2: polarX(rOut, deg), y2: polarY(rOut, deg), major });
    }
    return arr;
  }, []);
  const litIndex = Math.round((label / 100) * (TICK_COUNT - 1));

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <GestureDetector gesture={pan}>
        <View style={styles.ring} collapsable={false}>
          <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
            <Path d={TRACK_D} stroke={colors.off18} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
            {tickGeom.map((t, i) => {
              const lit = label > 0 && i <= litIndex;
              return (
                <Line
                  key={i}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke={lit ? colors.green : t.major ? colors.lineStrong : colors.line}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              );
            })}
            <AnimatedPath animatedProps={fillProps} stroke={colors.green} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          </Svg>
        </View>
      </GestureDetector>

      <PressableScale
        style={[styles.center, { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31 }]}
        onPress={handleCenterPress}
        disabled={disabled}
        accessibilityLabel={multi ? `Switch active display, currently ${activeDisplay.name}` : `${activeDisplay.name} brightness`}
      >
        <View style={styles.pctRow}>
          <Text style={styles.pct} allowFontScaling={false}>
            {label}
          </Text>
          <Text style={styles.pctSign} allowFontScaling={false}>
            %
          </Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {activeDisplay.name}
        </Text>
        <Text style={[styles.note, !isSoftware && styles.noteHidden]}>software</Text>
      </PressableScale>

      {multi && effective.length <= BLOOM_MAX && (
        <Bloom
          size={size}
          open={bloomOpen}
          displays={effective}
          activeId={activeId}
          levels={levels}
          onSelect={handleChipSelect}
        />
      )}

      {multi && !bloomOpen && (
        <Text style={styles.hint} numberOfLines={1}>
          tap center to switch
        </Text>
      )}
    </View>
  );
}

/* ------------------------------- bloom ------------------------------- */

// A tidy upward fan of typographic chips. Kept to the top ~76deg arc (never a
// full circle) so chips rise out of the dial without colliding with the volume
// rail on the right at 360px; positions use a fixed chip footprint so each one
// is centered exactly on its target point.
const CHIP_W = 94;
const CHIP_H = 46;
const FAN_FROM = -128;
const FAN_TO = -52;

function Bloom({
  size,
  open,
  displays,
  activeId,
  levels,
  onSelect,
}: {
  size: number;
  open: boolean;
  displays: Display[];
  activeId: string;
  levels: Record<string, number>;
  onSelect: (id: string) => void;
}) {
  const n = displays.length;
  const radius = size / 2 + 34;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'box-none' : 'none'}>
      {displays.map((d, i) => {
        const deg = n === 1 ? -90 : FAN_FROM + (FAN_TO - FAN_FROM) * (i / (n - 1));
        const tx = Math.cos((deg * Math.PI) / 180) * radius;
        const ty = Math.sin((deg * Math.PI) / 180) * radius;
        return (
          <BloomChip
            key={d.id}
            open={open}
            index={i}
            left={size / 2 + tx - CHIP_W / 2}
            top={size / 2 + ty - CHIP_H / 2}
            tx={tx}
            ty={ty}
            name={d.name}
            value={levels[d.id] ?? Math.round(displayLevel(d))}
            active={d.id === activeId}
            onPress={() => onSelect(d.id)}
          />
        );
      })}
    </View>
  );
}

function BloomChip({
  open,
  index,
  left,
  top,
  tx,
  ty,
  name,
  value,
  active,
  onPress,
}: {
  open: boolean;
  index: number;
  left: number;
  top: number;
  tx: number;
  ty: number;
  name: string;
  value: number;
  active: boolean;
  onPress: () => void;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = open
      ? withDelay(index * 45, withSpring(1, { damping: 13, stiffness: 170, mass: 0.7 }))
      : withTiming(0, { duration: 160 });
  }, [open, index, p]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateX: -tx * (1 - p.value) }, { translateY: -ty * (1 - p.value) }, { scale: 0.4 + 0.6 * p.value }],
  }));

  return (
    <Animated.View style={[styles.chipWrap, { left, top, width: CHIP_W, height: CHIP_H }, animStyle]} pointerEvents={open ? 'auto' : 'none'}>
      <PressableScale
        style={[styles.chip, active && styles.chipActive]}
        onPress={onPress}
        accessibilityLabel={`${name}, ${value} percent`}
      >
        <Text style={styles.chipName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.chipVal, active && styles.chipValActive]}>{value}%</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  ring: { width: '100%', height: '100%' },
  center: {
    position: 'absolute',
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctRow: { flexDirection: 'row', alignItems: 'baseline' },
  pct: { fontFamily: fonts.display, fontSize: 34, color: colors.off, lineHeight: 36 },
  pctSign: { fontFamily: fonts.display, fontSize: 15, color: colors.off55, marginLeft: 1 },
  name: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.off72,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
    maxWidth: '86%',
  },
  note: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.off38,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  noteHidden: { opacity: 0 },
  hint: {
    position: 'absolute',
    bottom: -22,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.off38,
  },
  chipWrap: { position: 'absolute' },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: 14,
    backgroundColor: colors.ink700,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  chipActive: { borderColor: colors.green24, backgroundColor: colors.ink600 },
  chipName: { fontFamily: fonts.bold, fontSize: 12, color: colors.off, maxWidth: CHIP_W - 16 },
  chipVal: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.off38 },
  chipValActive: { color: colors.green },
});
