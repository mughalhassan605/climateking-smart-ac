import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ChevronRightIcon, PowerIcon } from '../../components/icons';
import { EmptyState } from '../../components/feedback';
import { Screen, ScreenHeader, Spacer } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import { BridgeStatusBanner } from '../home/HomeParts';
import { BRAND_INFO } from './DeviceSettingsScreen';
import { useBridges, useDeviceRealtime, useDevices, useToggleDevicePower } from './hooks';
import { Device, formatTemp, MODE_LABEL_KEY, modeColor } from './types';

// Every AC in one list, with what matters at a glance: reachable or not, on or off, and why not.
export function MyACsScreen() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const devicesQ = useDevices();
  const bridgesQ = useBridges();
  const toggle = useToggleDevicePower();
  useDeviceRealtime();

  const open = (device: Device) => navigation.navigate('HomeTab', { screen: 'DeviceControl', params: { deviceId: device.id } });
  const add = () => navigation.navigate('HomeTab', { screen: 'AddDevice' });
  const devices = devicesQ.data ?? [];
  const online = devices.filter(d => d.status === 'online').length;

  return (
    <Screen edges={{ top: true, bottom: false }} padded={false}>
      <View style={styles.header}>
        <ScreenHeader title={t('myAcs.title')} />
      </View>
      <FlatList
        data={devices}
        keyExtractor={d => d.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <BridgeStatusBanner bridges={bridgesQ.data} onPress={add} />
            <Spacer size="lg" />
            {devices.length ? (
              <Text variant="overline" tone="muted">
                {online} of {devices.length} online
              </Text>
            ) : null}
            <Spacer size="sm" />
          </View>
        }
        ListEmptyComponent={<EmptyState title={t('myAcs.title')} description={t('myAcs.noneYet')} actionLabel={t('devices.addDeviceShort')} onAction={add} />}
        ItemSeparatorComponent={() => <Spacer size="sm" />}
        renderItem={({ item }) => {
          const offline = item.status === 'offline';
          const active = item.isOn && !offline;
          const tint = modeColor(theme, item.mode);
          return (
            <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.dot, { backgroundColor: offline ? theme.colors.warning : theme.colors.success }]} />
              <View style={styles.flex}>
                <Text variant="label" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text variant="caption" tone={offline ? 'warning' : 'muted'} numberOfLines={1}>
                  {offline
                    ? item.lastError || t('device.offline')
                    : `${BRAND_INFO[item.brand].label} · ${item.roomName} · ${active ? `${t(MODE_LABEL_KEY[item.mode])} ${formatTemp(item.targetTemp)}` : 'Off'}`}
                </Text>
              </View>
              <Pressable
                onPress={() => toggle.toggle(item, !item.isOn)}
                disabled={offline}
                hitSlop={8}
                accessibilityRole="switch"
                accessibilityState={{ checked: item.isOn, disabled: offline }}
                style={[styles.power, { backgroundColor: active ? tint : theme.colors.surfaceMuted }, offline && styles.dim]}
              >
                <PowerIcon size={18} color={active ? theme.colors.onPrimary : theme.colors.textSecondary} />
              </Pressable>
              <ChevronRightIcon size={18} color={theme.colors.textMuted} />
            </Pressable>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={devicesQ.isFetching} onRefresh={() => devicesQ.refetch()} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create(theme => ({
  header: { paddingHorizontal: theme.spacing.lg },
  list: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl4, flexGrow: 1 },
  flex: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.75 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  power: { width: 36, height: 36, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.4 },
}));
