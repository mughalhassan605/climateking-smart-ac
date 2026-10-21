import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { RegionSelectScreen } from '../features/auth/RegionSelectScreen';
import { RegisterScreen } from '../features/auth/RegisterScreen';
import { LegalDocumentScreen } from '../features/legal/LegalDocumentScreen';
import { useSession } from '../features/auth/session';
import { hasCompletedOnboarding, OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { MainTabNavigator } from './MainTabNavigator';
import type { AuthStackParams } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParams>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName={hasCompletedOnboarding() ? 'Login' : 'Onboarding'}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="RegionSelect" component={RegionSelectScreen} options={{ animation: 'slide_from_bottom' }} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </AuthStack.Navigator>
  );
}

function SessionSplash() {
  const { theme } = useUnistyles();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

export function RootNavigator() {
  const { status } = useSession();
  if (status === 'restoring') return <SessionSplash />;
  return status === 'authenticated' ? <MainTabNavigator /> : <AuthNavigator />;
}
