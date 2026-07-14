// Global toast, ported from deck.html's #toast: pill, bottom-docked above
// the safe area, fades/slides in. A single instance lives at the App root so
// any screen can call useToast().show(...).
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { IconCheck } from './icons';
import { colors, fonts, radii, railWidth } from '../theme';

interface ToastContextValue {
  show: (message: string, ms?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string, ms = 2200) => {
      setMessage(msg);
      opacity.value = withTiming(1, { duration: 250 });
      translateY.value = withTiming(0, { duration: 250 });
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 250 });
        translateY.value = withTiming(10, { duration: 250 });
      }, ms);
    },
    [opacity, translateY]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { bottom: insets.bottom + 24 }, animatedStyle]}
      >
        <IconCheck size={15} color={colors.green} />
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </Animated.View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    left: railWidth,
    right: railWidth,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  text: {
    color: colors.off,
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'center',
  },
});
