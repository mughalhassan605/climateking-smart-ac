import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useUnistyles } from 'react-native-unistyles';
import { HomeIcon, SnowflakeIcon, UserIcon } from '../components/icons';
import { Screen, ScreenHeader } from '../components/layout';
import { EmptyState } from '../components/feedback';
import { Text } from '../components/Text';
import { useI18n } from '../i18n';
import { AddDeviceScreen } from '../features/devices/AddDeviceScreen';
import { DeviceControlScreen } from '../features/devices/DeviceControlScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { useSession } from '../features/auth/session';
import type { DeviceStackParams, MainTabParams, ProfileStackParams } from './types';

const DeviceStack = createNativeStackNavigator<DeviceStackParams>();
const ProfileStack = createNativeStackNavigator<ProfileStackParams>();
const Tab = createBottomTabNavigator<MainTabParams>();

// Lightweight placeholders for routes not yet built; they keep navigation whole.
function Placeholder({ title, onBack }: { title: string; onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <Screen edges={{ top: true, bottom: false }}>
      {onBack ? <ScreenHeader title={title} onBack={onBack} backLabel={t('common.back')} /> : null}
      <EmptyState title={title} description={t('common.loading')} />
    </Screen>
  );
}

function DeviceStackNavigator() {
  const { t } = useI18n();
  return (
    <DeviceStack.Navigator screenOptions={{ headerShown: false }}>
      <DeviceStack.Screen name="Home" component={HomeScreen} />
      <DeviceStack.Screen name="DeviceControl" component={DeviceControlScreen} />
      <DeviceStack.Screen name="DeviceSettings">
        {p => <Placeholder title={t('settings.title')} onBack={() => p.navigation.goBack()} />}
      </DeviceStack.Screen>
      <DeviceStack.Screen name="AddDevice" component={AddDeviceScreen} />
      <DeviceStack.Screen name="RoomManagement">
        {p => <Placeholder title={t('rooms.title')} onBack={() => p.navigation.goBack()} />}
      </DeviceStack.Screen>
      <DeviceStack.Screen name="Messages">
        {p => <Placeholder title={t('messages.title')} onBack={() => p.navigation.goBack()} />}
      </DeviceStack.Screen>
      <DeviceStack.Screen name="Help">
        {p => <Placeholder title={t('help.title')} onBack={() => p.navigation.goBack()} />}
      </DeviceStack.Screen>
    </DeviceStack.Navigator>
  );
}

function ProfileHub() {
  const { t } = useI18n();
  const { user, signOut } = useSession();
  return (
    <Screen edges={{ top: true, bottom: false }}>
      <ScreenHeader title={t('profile.account')} />
      <EmptyState
        title={user?.name ?? t('profile.title')}
        description={user?.email}
        actionLabel={t('common.signOut')}
        onAction={signOut}
      />
    </Screen>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileHub" component={ProfileHub} />
    </ProfileStack.Navigator>
  );
}

function MyACsScreen() {
  const { t } = useI18n();
  return (
    <Screen edges={{ top: true, bottom: false }}>
      <ScreenHeader title={t('myAcs.title')} />
      <EmptyState title={t('myAcs.title')} description={t('myAcs.noneYet')} />
    </Screen>
  );
}

export function MainTabNavigator() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarLabelStyle: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DeviceStackNavigator}
        options={{ title: t('nav.home'), tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="ACTab"
        component={MyACsScreen}
        options={{ title: t('nav.myAcs'), tabBarIcon: ({ color, size }) => <SnowflakeIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ title: t('nav.profile'), tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
