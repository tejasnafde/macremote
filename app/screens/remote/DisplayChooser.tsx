// Display chooser bottom sheet: lets you pick which /displays entry the
// brightness buttons target when the Mac reports more than one. Shell
// (backdrop, slide-up sheet, handle, soft easing) ported straight from
// SleepSheet.tsx since deck.html predates multi-display support and has no
// mockup of its own for this — same visual language, new content.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/PressableScale';
import { IconCheck } from '../../components/icons';
import { Display } from '../../lib/api';
import { colors, durations, easingCurves, fonts, radii } from '../../theme';

interface DisplayChooserProps {
  visible: boolean;
  onClose: () => void;
  displays: Display[];
  /** null = no explicit choice made yet; the built-in display is treated as selected. */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DisplayChooser({ visible, onClose, displays, selectedId, onSelect }: DisplayChooserProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 600, {
      duration: durations.sheet,
      easing: Easing.bezier(...easingCurves.soft),
    });
    backdropOpacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const effectiveSelected = selectedId ?? displays.find((d) => d.builtin)?.id ?? null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>
        <Pressable onPress={onClose}>
          <View style={styles.handle} />
        </Pressable>

        <Text style={styles.title}>Brightness Target</Text>
        <Text style={styles.subtitle}>Choose which screen the brightness buttons control.</Text>

        <View style={styles.list}>
          {displays.map((d) => {
            const isSelected = d.id === effectiveSelected;
            return (
              <PressableScale
                key={d.id}
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => onSelect(d.id)}
              >
                <Text style={styles.rowName} numberOfLines={1}>
                  {d.name}
                  {d.brightness != null ? `, ${d.brightness}` : ''}
                </Text>
                {isSelected && <IconCheck size={16} color={colors.green} />}
              </PressableScale>
            );
          })}
        </View>
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
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.lineStrong,
    alignSelf: 'center',
    marginVertical: 8,
  },
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.off, marginBottom: 4, marginTop: 8 },
  subtitle: { fontFamily: fonts.body, fontSize: 12.5, color: colors.off55, marginBottom: 18, lineHeight: 18 },
  list: { gap: 9, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowSelected: { borderColor: colors.green24, backgroundColor: colors.ink700 },
  rowName: { fontFamily: fonts.bold, fontSize: 14, color: colors.off, flexShrink: 1 },
});
