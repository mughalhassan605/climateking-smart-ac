import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AutoIcon, ChevronLeftIcon, DropletIcon, FanIcon, FlameIcon, MinusIcon, PlusIcon, PowerIcon, SettingsIcon, SnowflakeIcon } from '../../components/icons';
import { EmptyState, Spinner } from '../../components/feedback';
import { Text } from '../../components/Text';
import { Spacer } from '../../components/layout';
import { useI18n } from '../../i18n';
import type { DeviceStackParams } from '../../navigation/types';
import { clampTemp, useDevice, useDevicePatch, useDeviceRealtime, useToggleDevicePower } from './hooks';
import { useRoomLabel } from '../rooms/useRoomLabel';
import {
  Airflow,
  FAN_LABEL_KEY,
  FAN_LEVELS,
  FAN_PRESETS,
  FanSpeed,
  formatTemp,
  Mode,
  MODE_LABEL_KEY,
  modeColor,
} from './types';

const MODES: Mode[] = ['cool', 'heat', 'dry', 'fan', 'auto'];
const MODE_ICON = { cool: SnowflakeIcon, heat: FlameIcon, dry: DropletIcon, fan: FanIcon, auto: AutoIcon } as const;
const FAN_ORDER: FanSpeed[] = [...FAN_PRESETS.slice(0, 1), ...FAN_LEVELS, 'turbo'];

export function DeviceControlScreen() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<DeviceStackParams>>();
  const { params } = useRoute<RouteProp<DeviceStackParams, 'DeviceControl'>>();
  const roomLabel = useRoomLabel();
  const { data: device, isLoading } = useDevice(params.deviceId);
  const patch = useDevicePatch();
  const toggle = useToggleDevicePower();
  useDeviceRealtime();

  if (isLoading && !device) return <Spinner />;
  if (!device) {
    return <EmptyState title={t('deviceControl.loadFailed')} actionLabel={t('common.back')} onAction={() => navigation.goBack()} />;
  }

  const offline = device.status === 'offline';
  const active = device.isOn && !offline;
  const tint = modeColor(theme, device.mode);
  const disabled = offline || !device.isOn;

  const sending = patch.isPending || toggle.isPending;
  const setSwing = (axis: keyof Airflow) => {
    const current = device.airflow[axis];
    const next = { ...current, mode: current.mode === 'swing' ? ('off' as const) : ('swing' as const) };
    patch.mutate({ id: device.id, patch: { airflow: { ...device.airflow, [axis]: next } } });
  };

  const setTemp = (delta: number) => {
    const next = clampTemp(device.targetTemp + delta);
    if (next !== device.targetTemp) patch.mutate({ id: device.id, patch: { targetTemp: next } });
  };

  return (
    <View style={styles.root}>
      <View style={styles.backBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          <ChevronLeftIcon size={26} color={theme.colors.textPrimary} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('DeviceSettings', { deviceId: device.id })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          style={styles.back}
        >
          <SettingsIcon size={22} color={theme.colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="titleLg" numberOfLines={1}>
              {device.name}
            </Text>
            <Text variant="caption" tone={sending ? 'brand' : 'muted'}>
              {sending ? 'Sending to the AC…' : offline ? t('device.offline') : roomLabel(device.roomName)}
            </Text>
          </View>
          <Pressable
            onPress={() => toggle.toggle(device, !device.isOn)}
            disabled={offline}
            accessibilityRole="switch"
            accessibilityState={{ checked: device.isOn, disabled: offline }}
            style={({ pressed }) => [styles.power, { backgroundColor: active ? tint : theme.colors.surfaceMuted }, pressed && styles.pressed]}
          >
            <PowerIcon size={24} color={active ? theme.colors.onPrimary : theme.colors.textSecondary} />
          </Pressable>
        </View>

        {offline ? (
          <View style={styles.notice}>
            <Text variant="label">Not reachable right now</Text>
            <Text variant="caption" tone="muted">
              {device.lastError || 'The Home Bridge has not heard from this AC recently. Check that it is powered and on the home Wi-Fi.'}
            </Text>
          </View>
        ) : null}

        <Spacer size="xl" />
        <View style={[styles.dial, { borderColor: active ? tint : theme.colors.border }]}>
          <Pressable onPress={() => setTemp(-1)} disabled={disabled} style={[styles.dialBtn, disabled && styles.dim]} accessibilityLabel={t('device.lowerTemp')}>
            <MinusIcon size={28} color={theme.colors.textPrimary} />
          </Pressable>
          <View style={styles.dialCenter}>
            <Text style={styles.bigTemp}>{offline ? '—' : formatTemp(device.targetTemp)}</Text>
            <Text variant="caption" tone="muted">
              {t('device.roomTempHumidity', { temp: formatTemp(device.currentTemp), humidity: device.humidity })}
            </Text>
          </View>
          <Pressable onPress={() => setTemp(1)} disabled={disabled} style={[styles.dialBtn, disabled && styles.dim]} accessibilityLabel={t('device.raiseTemp')}>
            <PlusIcon size={28} color={theme.colors.textPrimary} />
          </Pressable>
        </View>

        <Spacer size="xl" />
        <Text variant="overline" tone="muted">
          {t('deviceControl.mode')}
        </Text>
        <Spacer size="sm" />
        <View style={[styles.row, disabled && styles.dim]}>
          {MODES.map(m => {
            const Icon = MODE_ICON[m];
            const selected = device.mode === m;
            const c = modeColor(theme, m);
            return (
              <Pressable
                key={m}
                disabled={disabled}
                onPress={() => patch.mutate({ id: device.id, patch: { mode: m } })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.tile, { borderColor: selected ? c : theme.colors.border, backgroundColor: selected ? c : 'transparent' }]}
              >
                <Icon size={22} color={selected ? theme.colors.onPrimary : theme.colors.textSecondary} />
                <Text variant="caption" style={{ color: selected ? theme.colors.onPrimary : theme.colors.textSecondary }}>
                  {t(MODE_LABEL_KEY[m])}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Spacer size="xl" />
        <Text variant="overline" tone="muted">
          {t('deviceControl.fanSpeed')}
        </Text>
        <Spacer size="sm" />
        <View style={[styles.fanRow, disabled && styles.dim]}>
          {FAN_ORDER.map(f => {
            const selected = device.fanSpeed === f;
            return (
              <Pressable
                key={f}
                disabled={disabled}
                onPress={() => patch.mutate({ id: device.id, patch: { fanSpeed: f } })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, { borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: selected ? theme.colors.primary : 'transparent' }]}
              >
                <Text variant="caption" tone={selected ? 'onPrimary' : 'secondary'}>
                  {t(FAN_LABEL_KEY[f])}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Spacer size="xl" />
        <Text variant="overline" tone="muted">
          Swing
        </Text>
        <Spacer size="sm" />
        <View style={[styles.row, disabled && styles.dim]}>
          {(['vertical', 'horizontal'] as const).map(axis => {
            const on = device.airflow[axis].mode === 'swing';
            return (
              <Pressable
                key={axis}
                disabled={disabled}
                onPress={() => setSwing(axis)}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                style={[styles.tile, on ? { borderColor: tint, backgroundColor: tint } : { borderColor: theme.colors.border }]}
              >
                <Text variant="label" style={{ color: on ? theme.colors.onPrimary : theme.colors.textSecondary }}>
                  {axis === 'vertical' ? 'Up – down' : 'Left – right'}
                </Text>
                <Text variant="caption" style={{ color: on ? theme.colors.onPrimary : theme.colors.textMuted }}>
                  {on ? 'On' : 'Off'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Spacer size="xl2" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  root: { flex: 1, backgroundColor: theme.colors.background, paddingTop: rt.insets.top },
  backBar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg },
  back: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  content: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  power: { width: 48, height: 48, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  dial: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderRadius: theme.radius.xl3,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl2,
  },
  dialBtn: { width: 56, height: 56, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  dialCenter: { alignItems: 'center', gap: 4 },
  bigTemp: { fontSize: 72, lineHeight: 78, fontWeight: '700', letterSpacing: -2, color: theme.colors.textPrimary },
  dim: { opacity: 0.45 },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  tile: { flex: 1, alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.md, borderRadius: theme.radius.lg, borderWidth: 1 },
  fanRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  notice: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.surface,
  },
  chip: { paddingHorizontal: theme.spacing.lg, height: 38, borderRadius: theme.radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
}));
