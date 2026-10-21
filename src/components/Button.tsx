import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
};

const TONE = { primary: 'onPrimary', secondary: 'base', ghost: 'brand', danger: 'inverse' } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
}: Props) {
  const { theme } = useUnistyles();
  const isDisabled = disabled || loading;
  styles.useVariants({ variant, size, fullWidth, disabled: isDisabled });
  const spinnerColor = {
    primary: theme.colors.onPrimary,
    secondary: theme.colors.textSecondary,
    ghost: theme.colors.primary,
    danger: theme.colors.textInverse,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={spinnerColor} /> : icon}
        <Text variant="label" tone={TONE[variant]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create(theme => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    variants: {
      variant: {
        primary: { backgroundColor: theme.colors.primary },
        secondary: { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
        ghost: { backgroundColor: 'transparent' },
        danger: { backgroundColor: theme.colors.danger },
      },
      size: {
        sm: { height: 40, paddingHorizontal: theme.spacing.lg },
        md: { height: 48, paddingHorizontal: theme.spacing.xl2 },
        lg: { height: 56, paddingHorizontal: theme.spacing.xl3 },
      },
      fullWidth: {
        true: { alignSelf: 'stretch' },
        false: { alignSelf: 'flex-start' },
      },
      disabled: {
        true: { opacity: 0.5 },
        false: {},
      },
    },
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  content: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
}));
