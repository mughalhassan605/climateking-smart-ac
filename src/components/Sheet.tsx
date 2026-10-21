import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useI18n } from '../i18n';
import { motion } from '../theme/tokens';
import { Button } from './Button';
import { Spacer } from './layout';
import { Text } from './Text';

type SheetProps = { visible: boolean; onClose: () => void; children?: React.ReactNode; avoidKeyboard?: boolean };

// Bottom sheet from the original (module 1428): dimmed backdrop, rounded top, drag handle.
export function Sheet({ visible, onClose, children, avoidKeyboard = false }: SheetProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(1000)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: motion.duration.base, useNativeDriver: true }),
        Animated.spring(translate, { toValue: 0, ...motion.spring.snappy, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: motion.duration.fast, useNativeDriver: true }),
        Animated.timing(translate, {
          toValue: 1000,
          duration: motion.duration.base,
          easing: Easing.bezier(0.3, 0, 1, 1),
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible, mounted, backdrop, translate]);

  if (!mounted) return null;
  const body = (
    <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 20, transform: [{ translateY: translate }] }]}>
      <View style={styles.handle} />
      {children}
    </Animated.View>
  );
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        {avoidKeyboard ? <KeyboardAvoidingView behavior="padding">{body}</KeyboardAvoidingView> : body}
      </View>
    </Modal>
  );
}

type NoticeProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  icon?: React.ReactNode;
  iconTint?: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  onCancel?: () => void;
  destructive?: boolean;
};

export function NoticeSheet({
  visible,
  onClose,
  title,
  message,
  icon,
  iconTint,
  confirmLabel,
  onConfirm,
  cancelLabel,
  onCancel,
  destructive = false,
}: NoticeProps) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {icon ? (
        <View style={styles.iconWrap}>
          <View style={[styles.iconBadge, iconTint ? { backgroundColor: iconTint } : styles.iconBadgeDefault]}>{icon}</View>
        </View>
      ) : null}
      <Text variant="title" center>
        {title}
      </Text>
      <Spacer size="xs" />
      {message ? (
        <Text variant="body" tone="secondary" center>
          {message}
        </Text>
      ) : null}
      <Spacer size="xl" />
      {cancelLabel ? (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label={cancelLabel} variant="secondary" fullWidth onPress={onCancel ?? onClose} />
          </View>
          <View style={styles.flex}>
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} fullWidth onPress={onConfirm} />
          </View>
        </View>
      ) : (
        <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} fullWidth onPress={onConfirm} />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl2,
    borderTopRightRadius: theme.radius.xl2,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  iconWrap: { alignItems: 'center', marginBottom: theme.spacing.lg },
  iconBadge: { width: 64, height: 64, borderRadius: theme.radius.xl, alignItems: 'center', justifyContent: 'center' },
  iconBadgeDefault: { backgroundColor: theme.colors.primaryMuted },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
}));
