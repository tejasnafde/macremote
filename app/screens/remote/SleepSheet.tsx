// Sleep timer bottom sheet, ported from deck.html's #sheet: chips (15/30/45/
//60 + custom stepper) -> Arm -> POST /sleep-timer, a running countdown mode
// once a timer is armed (driven from /status sleep_timer.remaining_seconds),
// a "put Mac to sleep now" confirm sub-flow, and cancel from either the
// running mode or the docked pill (see TimerPill below in RemoteScreen).
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/PressableScale';
import { IconCheck, IconMinus, IconMoon, IconPlus } from '../../components/icons';
import { colors, durations, easingCurves, fonts, radii } from '../../theme';

const CHIP_CHOICES = [15, 30, 45, 60];

function fmtTime(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

type SleepMode = 'sleep' | 'blackout';

interface SleepSheetProps {
  visible: boolean;
  onClose: () => void;
  remainingSeconds: number | null;
  timerMode?: SleepMode | null;
  onArm: (minutes: number, mode: SleepMode) => void;
  onCancelTimer: () => void;
  onSleepNow: () => void;
  onBlackoutNow: () => void;
  onScreensOn: () => void;
}

type TransientMode = 'confirm' | 'done' | 'edit' | null;

export function SleepSheet({
  visible,
  onClose,
  remainingSeconds,
  timerMode,
  onArm,
  onCancelTimer,
  onSleepNow,
  onBlackoutNow,
  onScreensOn,
}: SleepSheetProps) {
  const insets = useSafeAreaInsets();
  const [transientMode, setTransientMode] = useState<TransientMode>(null);
  const [selectedMins, setSelectedMins] = useState(60);
  const [customMode, setCustomMode] = useState(false);
  const [stepMins, setStepMins] = useState(20);
  const [localRemaining, setLocalRemaining] = useState(remainingSeconds);

  const translateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 600, {
      duration: durations.sheet,
      easing: Easing.bezier(...easingCurves.soft),
    });
    backdropOpacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
    if (visible) setTransientMode(null);
  }, [visible, translateY, backdropOpacity]);

  useEffect(() => {
    setLocalRemaining(remainingSeconds);
    if (remainingSeconds == null) return;
    const id = setInterval(() => {
      setLocalRemaining((r) => (r != null ? Math.max(0, r - 1) : r));
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSeconds]);

  const [armMode, setArmMode] = useState<SleepMode>('sleep');

  const mode: 'select' | 'confirm' | 'done' | 'running' | 'edit' =
    transientMode ?? (remainingSeconds != null ? 'running' : 'select');
  const selecting = mode === 'select' || mode === 'edit';

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const fading = mode === 'running' && (localRemaining ?? 0) <= 60;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}
      >
        <Pressable onPress={onClose}>
          <View style={styles.handle} />
        </Pressable>

        {selecting && (
          <View>
            <Text style={styles.title}>{mode === 'edit' ? 'Change Timer' : 'Sleep Timer'}</Text>
            <Text style={styles.subtitle}>
              {armMode === 'sleep'
                ? 'Fades your volume over the final minute, then sleeps the Mac.'
                : 'Fades your volume, then turns volume and every screen to zero. The Mac stays awake.'}
            </Text>
            <View style={styles.modeRow}>
              <PressableScale
                style={[styles.modeBtn, armMode === 'sleep' && styles.modeBtnSelected]}
                onPress={() => setArmMode('sleep')}
              >
                <Text style={[styles.modeBtnText, armMode === 'sleep' && styles.modeBtnTextSelected]}>
                  Sleep Mac
                </Text>
              </PressableScale>
              <PressableScale
                style={[styles.modeBtn, armMode === 'blackout' && styles.modeBtnSelected]}
                onPress={() => setArmMode('blackout')}
              >
                <Text style={[styles.modeBtnText, armMode === 'blackout' && styles.modeBtnTextSelected]}>
                  Screens Off
                </Text>
              </PressableScale>
            </View>
            <View style={styles.chipRow}>
              {CHIP_CHOICES.map((m) => (
                <PressableScale
                  key={m}
                  style={[styles.chip, !customMode && selectedMins === m && styles.chipSelected]}
                  onPress={() => {
                    setCustomMode(false);
                    setSelectedMins(m);
                  }}
                >
                  <Text style={[styles.chipText, !customMode && selectedMins === m && styles.chipTextSelected]}>
                    {m} min
                  </Text>
                </PressableScale>
              ))}
              <PressableScale
                style={[styles.chip, customMode && styles.chipSelected]}
                onPress={() => {
                  setCustomMode(true);
                  setSelectedMins(stepMins);
                }}
              >
                <Text style={[styles.chipText, customMode && styles.chipTextSelected]}>Custom</Text>
              </PressableScale>
            </View>

            {customMode && (
              <View style={styles.stepper}>
                <Text style={styles.stepperValue}>
                  {stepMins}
                  <Text style={styles.stepperUnit}> min</Text>
                </Text>
                <View style={styles.stepperBtns}>
                  <PressableScale
                    style={styles.stepperBtn}
                    onPress={() => {
                      const next = Math.max(5, stepMins - 5);
                      setStepMins(next);
                      setSelectedMins(next);
                    }}
                  >
                    <IconMinus size={16} color={colors.off} />
                  </PressableScale>
                  <PressableScale
                    style={styles.stepperBtn}
                    onPress={() => {
                      const next = Math.min(180, stepMins + 5);
                      setStepMins(next);
                      setSelectedMins(next);
                    }}
                  >
                    <IconPlus size={16} color={colors.off} />
                  </PressableScale>
                </View>
              </View>
            )}

            <PressableScale
              style={styles.primaryBtn}
              onPress={() => {
                onArm(selectedMins, armMode);
                if (mode === 'edit') setTransientMode(null);
              }}
            >
              <Text style={styles.primaryBtnLabel}>
                {mode === 'edit' ? 'Update' : 'Start'} Timer · {selectedMins} min
              </Text>
            </PressableScale>
            {mode === 'edit' ? (
              <PressableScale style={styles.sleepNowLink} onPress={() => setTransientMode(null)}>
                <Text style={styles.sleepNowLinkText}>Back to countdown</Text>
              </PressableScale>
            ) : (
              <View style={styles.nowRow}>
                <PressableScale style={styles.sleepNowLink} onPress={() => setTransientMode('confirm')}>
                  <IconMoon size={15} color={colors.off55} />
                  <Text style={styles.sleepNowLinkText}>Sleep now</Text>
                </PressableScale>
                <PressableScale
                  style={styles.sleepNowLink}
                  onPress={() => {
                    onBlackoutNow();
                    onClose();
                  }}
                >
                  <Text style={styles.sleepNowLinkText}>Screens off now</Text>
                </PressableScale>
                <PressableScale
                  style={styles.sleepNowLink}
                  onPress={() => {
                    onScreensOn();
                    onClose();
                  }}
                >
                  <Text style={styles.sleepNowLinkText}>Screens on</Text>
                </PressableScale>
              </View>
            )}
          </View>
        )}

        {mode === 'confirm' && (
          <View style={styles.confirmWrap}>
            <View style={styles.confirmIcon}>
              <IconMoon size={24} color={colors.off} />
            </View>
            <Text style={styles.confirmTitle}>Sleep now?</Text>
            <Text style={styles.confirmBody}>Your Mac will go to sleep immediately.</Text>
            <View style={styles.confirmRow}>
              <PressableScale style={styles.secondaryBtn} onPress={() => setTransientMode(null)}>
                <Text style={styles.secondaryBtnLabel}>Cancel</Text>
              </PressableScale>
              <PressableScale
                style={styles.primaryBtn}
                onPress={() => {
                  onSleepNow();
                  setTransientMode('done');
                  setTimeout(() => {
                    onClose();
                    setTimeout(() => setTransientMode(null), 400);
                  }, 1400);
                }}
              >
                <Text style={styles.primaryBtnLabel}>Sleep Now</Text>
              </PressableScale>
            </View>
          </View>
        )}

        {mode === 'done' && (
          <View style={styles.doneWrap}>
            <View style={styles.doneIcon}>
              <IconCheck size={22} color={colors.green} />
            </View>
            <Text style={styles.confirmTitle}>Goodnight.</Text>
            <Text style={styles.confirmBody}>Your Mac is going to sleep.</Text>
          </View>
        )}

        {mode === 'running' && (
          <View style={styles.countdownWrap}>
            <Text style={styles.countdownLabel}>
              {timerMode === 'blackout' ? 'Screens off in' : 'Falling asleep in'}
            </Text>
            <Text style={styles.countdownNum}>{fmtTime(localRemaining ?? 0)}</Text>
            <Text style={[styles.countdownCaption, fading && styles.countdownCaptionFading]}>
              {fading ? 'Fading your volume now.' : 'Volume will fade over the final minute.'}
            </Text>
            <View style={styles.confirmRow}>
              <PressableScale
                style={styles.secondaryBtn}
                onPress={() => {
                  setArmMode(timerMode ?? 'sleep');
                  setTransientMode('edit');
                }}
              >
                <Text style={styles.secondaryBtnLabel}>Change</Text>
              </PressableScale>
              <PressableScale style={styles.secondaryBtn} onPress={onCancelTimer}>
                <Text style={styles.secondaryBtnLabel}>Cancel Timer</Text>
              </PressableScale>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(6,8,10,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ink900,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: radii.full, backgroundColor: colors.lineStrong, alignSelf: 'center', marginVertical: 8 },
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.off, marginBottom: 4, marginTop: 8 },
  subtitle: { fontFamily: fonts.body, fontSize: 12.5, color: colors.off55, marginBottom: 20, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 18 },
  modeRow: { flexDirection: 'row', gap: 9, marginBottom: 16 },
  modeBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnSelected: { borderColor: colors.green, backgroundColor: colors.green14 },
  modeBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.off72 },
  modeBtnTextSelected: { color: colors.green },
  nowRow: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
  chip: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radii.sm,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.off72 },
  chipTextSelected: { color: colors.greenInk },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingLeft: 18,
    paddingRight: 8,
    marginBottom: 18,
  },
  stepperValue: { fontFamily: fonts.display, fontSize: 19, color: colors.off },
  stepperUnit: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.off55 },
  stepperBtns: { flexDirection: 'row', gap: 6 },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.ink700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryBtnLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.greenInk },
  sleepNowLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
  },
  sleepNowLinkText: { fontFamily: fonts.bold, fontSize: 13, color: colors.off55 },
  confirmWrap: { alignItems: 'center', paddingVertical: 6 },
  confirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ink700,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.off, marginBottom: 6 },
  confirmBody: { fontFamily: fonts.body, fontSize: 13, color: colors.off55, marginBottom: 20, textAlign: 'center' },
  confirmRow: { flexDirection: 'row', gap: 10, width: '100%' },
  secondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.ink700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnFull: {
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.ink700,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryBtnLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.off },
  doneWrap: { alignItems: 'center', paddingVertical: 14 },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  countdownWrap: { alignItems: 'center', paddingVertical: 6 },
  countdownLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.off38,
    marginBottom: 8,
  },
  countdownNum: { fontFamily: fonts.display, fontSize: 56, color: colors.off, letterSpacing: -1 },
  countdownCaption: { fontFamily: fonts.body, fontSize: 13, color: colors.off55, marginTop: 12, marginBottom: 22 },
  countdownCaptionFading: { color: colors.green, fontFamily: fonts.bold },
});
