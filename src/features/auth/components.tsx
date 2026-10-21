import React, { useState } from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon, EyeOffIcon } from '../../components/icons';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';

export function AuthHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          <ChevronLeftIcon size={26} color={theme.colors.textPrimary} />
        </Pressable>
      ) : null}
      <Text variant="titleLg" style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

type FieldProps = Omit<TextInputProps, 'secureTextEntry'> & { password?: boolean };

export function TextField({ password = false, ...rest }: FieldProps) {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.field}>
      <TextInput
        {...rest}
        style={styles.input}
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={password && hidden}
      />
      {password ? (
        <Pressable
          onPress={() => setHidden(h => !h)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t(hidden ? 'common.showPassword' : 'common.hidePassword')}
          style={styles.trailing}
        >
          {hidden ? (
            <EyeOffIcon size={20} color={theme.colors.textMuted} />
          ) : (
            <EyeIcon size={20} color={theme.colors.textSecondary} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function SelectorField({ value, placeholder, onPress }: { value?: string; placeholder: string; onPress: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
      <Text variant="body" tone={value ? 'base' : 'muted'} style={styles.label}>
        {value || placeholder}
      </Text>
      <ChevronRightIcon size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export function AgreementCheckbox({
  checked,
  onToggle,
  onOpenDocument,
}: {
  checked: boolean;
  onToggle: () => void;
  onOpenDocument: (docId: 'userAgreement' | 'privacyPolicy') => void;
}) {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  styles.useVariants({ checked });
  // agreementTemplate reads "I have read and agreed the {{terms}} and {{privacy}}"
  const [before, rest = ''] = t('auth.agreementTemplate').split('{{terms}}');
  const [middle, after = ''] = rest.split('{{privacy}}');
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.row}>
      <View style={styles.box}>{checked ? <CheckIcon size={14} color={theme.colors.onPrimary} /> : null}</View>
      <Text variant="bodySm" tone="secondary" style={styles.agreeLabel}>
        {before}
        <Text variant="bodySm" tone="accent" accessibilityRole="link" onPress={() => onOpenDocument('userAgreement')}>
          {t('auth.agreementUserAgreement')}
        </Text>
        {middle}
        <Text variant="bodySm" tone="accent" accessibilityRole="link" onPress={() => onOpenDocument('privacyPolicy')}>
          {t('auth.agreementPrivacy')}
        </Text>
        {after}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create(theme => ({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: theme.spacing.sm },
  back: { marginLeft: -theme.spacing.xs },
  title: { flex: 1 },
  right: { alignItems: 'flex-end' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
  },
  input: {
    flex: 1,
    height: '100%',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.families.body,
    fontSize: theme.typography.sizes.base,
  },
  trailing: { paddingLeft: theme.spacing.sm },
  pressed: { opacity: 0.7 },
  label: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  box: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    variants: {
      checked: {
        true: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
        false: { backgroundColor: 'transparent', borderColor: theme.colors.borderStrong },
      },
    },
  },
  agreeLabel: { flex: 1 },
}));
