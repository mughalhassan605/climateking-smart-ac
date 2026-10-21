import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { Screen, Spacer } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import type { AuthStackParams } from '../../navigation/types';
import { authService, LoginInput } from './authService';
import { AgreementCheckbox, AuthHeader, SelectorField, TextField } from './components';
import { useSession } from './session';

export function LoginScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParams>>();
  const route = useRoute<RouteProp<AuthStackParams, 'Login'>>();
  const { adopt } = useSession();
  const region = route.params?.region;

  const [account, setAccount] = useState('demo@climateking.eu');
  const [password, setPassword] = useState('12345678');
  const [agreed, setAgreed] = useState(true);

  const login = useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: adopt,
  });

  const canSubmit = account.trim().length > 0 && password.length > 0 && agreed;
  const signIn = () => login.mutate({ account: account.trim(), password });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Screen scroll edges={{ top: true, bottom: true }}>
        <AuthHeader
          title={t('auth.signIn')}
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
          right={
            <Pressable onPress={() => navigation.navigate('Register', { region })} hitSlop={10} accessibilityRole="button">
              <Text variant="label" tone="accent">
                {t('auth.signUp')}
              </Text>
            </Pressable>
          }
        />
        <Spacer size="xl2" />
        <View style={styles.form}>
          <TextField
            value={account}
            onChangeText={setAccount}
            placeholder={t('auth.usernameOrEmail')}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField value={password} onChangeText={setPassword} placeholder={t('auth.password')} password textContentType="password" />
          <SelectorField
            value={region}
            placeholder={t('auth.regionPlaceholder')}
            onPress={() => navigation.navigate('RegionSelect', { selected: region, returnTo: 'Login' })}
          />
        </View>
        <Spacer size="lg" />
        <View style={styles.linksRow}>
          <Pressable
            onPress={() => navigation.navigate('ForgotPassword', { email: account.trim() })}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text variant="label" tone="secondary">
              {t('auth.forgotPassword')}
            </Text>
          </Pressable>
        </View>
        <View style={styles.flex} />
        {login.error ? (
          <>
            <Text variant="caption" tone="danger">
              {login.error.message}
            </Text>
            <Spacer size="sm" />
          </>
        ) : null}
        <AgreementCheckbox
          checked={agreed}
          onToggle={() => setAgreed(a => !a)}
          onOpenDocument={docId => navigation.navigate('LegalDocument', { docId })}
        />
        <Spacer size="lg" />
        <Button label={t('auth.signIn')} fullWidth disabled={!canSubmit} loading={login.isPending} onPress={signIn} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create(theme => ({
  flex: { flex: 1 },
  form: { gap: theme.spacing.lg },
  linksRow: { flexDirection: 'row', justifyContent: 'flex-end' },
}));
