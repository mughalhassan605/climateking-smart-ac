import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { Spacer } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import type { AuthStackParams } from '../../navigation/types';
import { authService, RegisterInput } from './authService';
import { AgreementCheckbox, AuthHeader, SelectorField, TextField } from './components';
import { useSession } from './session';
import { isValidEmail, MIN_PASSWORD_LENGTH } from './validation';

export function RegisterScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParams>>();
  const route = useRoute<RouteProp<AuthStackParams, 'Register'>>();
  const { adopt } = useSession();
  const region = route.params?.region;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);

  const register = useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
    onSuccess: adopt,
  });

  const canSubmit =
    region != null &&
    username.trim().length >= 2 &&
    isValidEmail(email) &&
    password.length >= MIN_PASSWORD_LENGTH &&
    agreed;

  const createAccount = () => {
    if (!canSubmit || register.isPending) return;
    register.mutate({ username: username.trim(), email: email.trim(), password, region });
  };

  return (
    <KeyboardAvoidingView style={[styles.flex, styles.root, { paddingTop: insets.top }]} behavior="padding">
      <View style={styles.padded}>
        <AuthHeader title={t('auth.signUp')} onBack={() => navigation.goBack()} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, styles.padded, { paddingBottom: insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Spacer size="xl2" />
        <View style={styles.form}>
          <SelectorField
            value={region}
            placeholder={t('auth.regionPlaceholder')}
            onPress={() => navigation.navigate('RegionSelect', { selected: region, returnTo: 'Register' })}
          />
          <TextField value={username} onChangeText={setUsername} placeholder={t('auth.username')} />
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email')}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.passwordPlaceholder', { min: MIN_PASSWORD_LENGTH })}
            password
            textContentType="oneTimeCode"
          />
        </View>
        <View style={styles.flex} />
        <Spacer size="xl2" />
        {register.error ? (
          <>
            <Text variant="caption" tone="danger">
              {register.error.message}
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
        <Button
          label={t('auth.createAccount')}
          fullWidth
          disabled={!canSubmit}
          loading={register.isPending}
          onPress={createAccount}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create(theme => ({
  flex: { flex: 1 },
  root: { backgroundColor: theme.colors.background },
  padded: { paddingHorizontal: theme.spacing.xl },
  content: { flexGrow: 1 },
  form: { gap: theme.spacing.lg },
}));
