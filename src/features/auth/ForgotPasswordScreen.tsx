import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { CheckIcon } from '../../components/icons';
import { Spacer } from '../../components/layout';
import { NoticeSheet } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import type { AuthStackParams } from '../../navigation/types';
import { authService, ResetPasswordInput } from './authService';
import { AuthHeader, TextField } from './components';
import { isValidEmail, MIN_PASSWORD_LENGTH, RESEND_SECONDS, RESET_CODE_LENGTH } from './validation';

export function ForgotPasswordScreen() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParams>>();
  const { params } = useRoute<RouteProp<AuthStackParams, 'ForgotPassword'>>();

  const [email, setEmail] = useState(params?.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [sentNote, setSentNote] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const send = useMutation({
    mutationFn: (to: string) => authService.sendPasswordReset(to),
    onSuccess: (res, to) => {
      setCooldown(RESEND_SECONDS);
      const base = t('auth.codeSentTo', { length: RESET_CODE_LENGTH, email: to });
      setSentNote(res?.devCode ? base + t('auth.devCodeSuffix', { code: res.devCode }) : base);
    },
  });
  const reset = useMutation({
    mutationFn: (input: ResetPasswordInput) => authService.resetPassword(input),
    onSuccess: () => setDone(true),
  });

  const codeSent = sentNote !== null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canReset =
    codeSent && code.length === RESET_CODE_LENGTH && password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  const sendLabel =
    cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : codeSent ? t('auth.resendCode') : t('auth.sendResetCode');

  const submit = () => {
    if (!canReset || reset.isPending) return;
    reset.mutate({ email: email.trim(), code, newPassword: password });
  };

  return (
    <KeyboardAvoidingView style={[styles.flex, styles.root, { paddingTop: insets.top }]} behavior="padding">
      <View style={styles.padded}>
        <AuthHeader title={t('auth.resetTitle')} onBack={() => navigation.goBack()} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, styles.padded, { paddingBottom: insets.bottom + theme.spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Spacer size="lg" />
        <Text variant="body" tone="secondary">
          {t('auth.resetIntro')}
        </Text>
        <Spacer size="xl" />
        <View style={styles.form}>
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder={t('common.email')}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!codeSent}
          />
          <Button
            label={sendLabel}
            variant="secondary"
            disabled={!isValidEmail(email) || cooldown > 0}
            loading={send.isPending}
            onPress={() => send.mutate(email.trim())}
          />
          {sentNote ? (
            <Text variant="caption" tone="secondary">
              {sentNote}
            </Text>
          ) : null}
          {send.error ? (
            <Text variant="caption" tone="danger">
              {send.error.message}
            </Text>
          ) : null}
          {codeSent ? (
            <>
              <TextField
                value={code}
                onChangeText={v => setCode(v.replace(/\D/g, ''))}
                placeholder={t('auth.enterCode', { length: RESET_CODE_LENGTH })}
                keyboardType="number-pad"
                maxLength={RESET_CODE_LENGTH}
              />
              <TextField
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.newPasswordPlaceholder', { min: MIN_PASSWORD_LENGTH })}
                password
                textContentType="oneTimeCode"
              />
              <TextField
                value={confirm}
                onChangeText={setConfirm}
                placeholder={t('auth.confirmNewPassword')}
                password
                textContentType="oneTimeCode"
              />
              {mismatch ? (
                <Text variant="caption" tone="danger">
                  {t('auth.passwordsDontMatch')}
                </Text>
              ) : null}
              {reset.error ? (
                <Text variant="caption" tone="danger">
                  {reset.error.message}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
        {codeSent ? (
          <View>
            <Spacer size="xl" />
            <Button label={t('auth.resetPassword')} fullWidth disabled={!canReset} loading={reset.isPending} onPress={submit} />
          </View>
        ) : null}
      </ScrollView>
      <NoticeSheet
        visible={done}
        title={t('auth.resetDoneTitle')}
        message={t('auth.resetDoneMessage')}
        icon={<CheckIcon size={30} color={theme.colors.onPrimary} />}
        iconTint={theme.colors.success}
        confirmLabel={t('auth.backToSignIn')}
        onConfirm={() => {
          setDone(false);
          navigation.navigate('Login');
        }}
        onClose={() => setDone(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create(theme => ({
  flex: { flex: 1 },
  root: { backgroundColor: theme.colors.background },
  padded: { paddingHorizontal: theme.spacing.xl },
  content: { paddingBottom: theme.spacing.xl },
  form: { gap: theme.spacing.lg },
}));
