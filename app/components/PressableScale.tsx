// Shared press affordance: every tappable surface in deck.html scales to
// .96 on `:active` with a 150ms cubic-bezier(.2,0,0,1) — this is that, as a
// reusable Pressable wrapper driven by Reanimated so it stays on the UI
// thread instead of re-rendering.
import { forwardRef } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { durations, easingCurves, pressScale } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disabled?: boolean;
}

export const PressableScale = forwardRef<React.ElementRef<typeof Pressable>, PressableScaleProps>(
  function PressableScale({ style, scaleTo = pressScale, onPressIn, onPressOut, disabled, ...rest }, ref) {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        onPressIn={(e) => {
          scale.value = withTiming(scaleTo, {
            duration: durations.press,
            easing: Easing.bezier(...easingCurves.standard),
          });
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withTiming(1, {
            duration: durations.press,
            easing: Easing.bezier(...easingCurves.standard),
          });
          onPressOut?.(e);
        }}
        style={[style, animatedStyle, disabled ? { opacity: 0.4 } : null]}
        {...rest}
      />
    );
  }
);
