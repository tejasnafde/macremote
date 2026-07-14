import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

interface RemoteButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'normal' | 'large';
}

/** Big-touch-target button used across the remote screen. */
export function RemoteButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'default',
  size = 'normal',
}: RemoteButtonProps) {
  const bg =
    variant === 'primary' ? theme.accent : variant === 'danger' ? theme.danger : theme.surfaceAlt;
  const fg = variant === 'default' ? theme.text : '#0b0f14';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        size === 'large' && styles.buttonLarge,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, size === 'large' && styles.labelLarge, { color: fg }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** A row of buttons that share width evenly. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    minWidth: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    flex: 1,
  },
  buttonLarge: {
    minHeight: 72,
  },
  label: {
    fontSize: 22,
    fontWeight: '600',
  },
  labelLarge: {
    fontSize: 28,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
