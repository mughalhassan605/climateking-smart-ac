import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, DimensionValue, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n';
import { radius as radiusTokens } from '../theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text variant="title" center>
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="secondary" center style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export function ErrorState({ title, message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <Text variant="title" center>
        {title ?? t('common.error')}
      </Text>
      {message ? (
        <Text variant="body" tone="secondary" center style={styles.description}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <View style={styles.action}>
          <Button label={t('common.retry')} variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

// Pulses between 0.5 and 1 over 800 ms like the original Skeleton (module 1412).
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'md',
}: {
  width?: DimensionValue;
  height?: number;
  radius?: keyof typeof radiusTokens;
}) {
  const { theme } = useUnistyles();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{ width, height, borderRadius: radiusTokens[radius], backgroundColor: theme.colors.skeleton, opacity }}
    />
  );
}

export function Spinner() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.fill}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xl2 },
  icon: { marginBottom: theme.spacing.lg },
  description: { marginTop: theme.spacing.sm },
  action: { marginTop: theme.spacing.xl2 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
}));
