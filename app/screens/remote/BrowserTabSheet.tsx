// Per-tab controls, moved off the list row and into a bottom sheet. The row
// used to carry five 28px buttons, which left the title about 68px on a 360px
// screen: every tab read as "Inb...", so you could not tell them apart. The row
// now spends its width on the name and the sheet holds the controls.
// Shell (backdrop, slide-up, handle, soft easing) matches DisplayChooser.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HSlider } from '../../components/HSlider';
import { PressableScale } from '../../components/PressableScale';
import {
  IconArrowUpRight,
  IconExpand,
  IconMute,
  IconPause,
  IconPlay,
  IconVolume,
} from '../../components/icons';
import { BrowserTab, BrowserTabAction } from '../../lib/api';
import { colors, durations, easingCurves, fonts, radii } from '../../theme';

interface BrowserTabSheetProps {
  /** null closes the sheet. */
  tab: BrowserTab | null;
  playing: boolean;
  onClose: () => void;
  onCommand: (tab: BrowserTab, action: BrowserTabAction) => void;
  onFullscreen: (tab: BrowserTab) => void;
  onVolumeSend: (tab: BrowserTab, v: number) => void;
  onVolumeCommit: (tab: BrowserTab, v: number) => void;
}

export function BrowserTabSheet({
  tab,
  playing,
  onClose,
  onCommand,
  onFullscreen,
  onVolumeSend,
  onVolumeCommit,
}: BrowserTabSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);
  const visible = tab != null;

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 600, {
      duration: durations.sheet,
      easing: Easing.bezier(...easingCurves.soft),
    });
    backdropOpacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  // Keep the last tab rendered through the close animation, so the sheet does
  // not blank out mid-slide.
  const shown = tab;
  const muted = shown?.muted ?? false;
  // The extension could not find a media element here, so play/pause and volume
  // would be no-ops. Say so rather than offering dead buttons.
  const drivable = shown ? shown.controllable ?? shown.volume != null : true;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>
        <Pressable onPress={onClose}>
          <View style={styles.handle} />
        </Pressable>

        {shown && (
          <>
            <Text style={styles.title} numberOfLines={2}>
              {shown.title || 'Untitled tab'}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {shown.url_host || (shown.browser === 'firefox' ? 'Firefox' : 'Chrome')}
              {playing ? ', playing' : ''}
            </Text>

            <View style={styles.actions}>
              <SheetAction
                label={playing ? 'Pause' : 'Play'}
                icon={playing ? <IconPause size={18} color={colors.greenInk} /> : <IconPlay size={18} color={colors.greenInk} />}
                primary
                disabled={!drivable}
                onPress={() => onCommand(shown, playing ? 'pause' : 'play')}
              />
              <SheetAction
                label="Go to tab"
                icon={<IconArrowUpRight size={18} color={colors.off} />}
                onPress={() => onCommand(shown, 'focus')}
              />
              <SheetAction
                label="Fullscreen"
                icon={<IconExpand size={18} color={colors.off} />}
                onPress={() => onFullscreen(shown)}
              />
              <SheetAction
                label={muted ? 'Unmute' : 'Mute'}
                icon={<IconMute size={18} color={muted ? colors.green : colors.off} />}
                on={muted}
                onPress={() => onCommand(shown, 'mute')}
              />
            </View>

            {drivable ? (
              <View style={styles.volumeRow}>
                <IconVolume size={15} color={colors.off55} />
                <View style={styles.sliderWrap}>
                  <HSlider
                    value={shown.volume ?? 100}
                    onSend={(v) => onVolumeSend(shown, v)}
                    onCommit={(v) => onVolumeCommit(shown, v)}
                    showValue
                    accessibilityLabel="Tab volume"
                  />
                </View>
              </View>
            ) : (
              <Text style={styles.note}>
                This player sits in a frame the extension cannot reach, so the big play button
                controls it instead. Go to tab and fullscreen still work.
              </Text>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

function SheetAction({
  label,
  icon,
  onPress,
  primary,
  on,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  primary?: boolean;
  on?: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      style={[styles.action, primary && styles.actionPrimary, on && styles.actionOn, disabled && styles.actionDisabled]}
      onPress={disabled ? () => undefined : onPress}
      accessibilityLabel={label}
    >
      {icon}
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text>
    </PressableScale>
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
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.lineStrong,
    alignSelf: 'center',
    marginVertical: 8,
  },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.off, marginTop: 8, lineHeight: 24 },
  subtitle: { fontFamily: fonts.body, fontSize: 12.5, color: colors.off55, marginTop: 4, marginBottom: 18 },
  actions: { flexDirection: 'row', gap: 9 },
  action: {
    flex: 1,
    height: 62,
    borderRadius: radii.sm,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionPrimary: { backgroundColor: colors.green, borderColor: colors.green },
  actionOn: { backgroundColor: colors.ink700, borderColor: colors.green24 },
  actionDisabled: { opacity: 0.4 },
  actionLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.off72 },
  actionLabelPrimary: { color: colors.greenInk },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 4 },
  sliderWrap: { flex: 1 },
  note: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.off55,
    lineHeight: 17,
    marginTop: 16,
    marginBottom: 4,
  },
});
