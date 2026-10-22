import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/feedback';
import { Card, Row, Screen, ScreenHeader, Spacer, Stack } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import type { DeviceStackParams } from '../../navigation/types';
import { deviceKeys, useDevice, useDevicePatch, useRemoveDevice } from './hooks';
import { fetchSecretNames, updateDeviceConnection } from './supabaseDevicesService';
import { Brand } from './types';

const ROOMS = ['Living Room', 'Bedroom', 'Office', 'Kitchen', 'Dining Room'];

export const BRAND_INFO: Record<Brand, { label: string; app: string; protocol: string }> = {
  gree: { label: 'Gree / Climate King', app: 'Gree+', protocol: 'Gree LAN · UDP 7000' },
  broadlink: { label: 'Kenwood', app: 'AC Freedom', protocol: 'BroadLink · UDP 80' },
  tcl: { label: 'TCL', app: 'Intelligent AC', protocol: 'BroadLink DNA · UDP 80' },
  tuya: { label: 'Smart Life', app: 'Smart Life', protocol: 'Tuya · TCP 6668 + cloud' },
  haier: { label: 'Haier', app: 'HaiSmart', protocol: 'uSS · TCP 56800' },
};

export function DeviceSettingsScreen() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const { params } = useRoute<RouteProp<DeviceStackParams, 'DeviceSettings'>>();
  const qc = useQueryClient();
  const { data: device } = useDevice(params.deviceId);
  const rename = useDevicePatch();
  const remove = useRemoveDevice();
  const secrets = useQuery({
    queryKey: [...deviceKeys.detail(params.deviceId), 'secrets'],
    queryFn: () => fetchSecretNames(params.deviceId),
  });

  const [name, setName] = useState('');
  const [room, setRoom] = useState(ROOMS[0]);
  const [ip, setIp] = useState('');
  const [mac, setMac] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [localKey, setLocalKey] = useState('');

  useEffect(() => {
    if (!device) return;
    setName(device.name);
    setRoom(device.roomName);
    setIp(device.ipAddress ?? '');
    setMac(device.macAddress ?? '');
  }, [device]);

  const saveConnection = useMutation({
    mutationFn: () =>
      updateDeviceConnection(params.deviceId, {
        ipAddress: ip,
        macAddress: mac,
        cloudId: device?.brand === 'tuya' && deviceId.trim() ? deviceId : undefined,
        secrets: { device_id: deviceId, local_key: localKey },
      }),
    onSuccess: () => {
      setLocalKey('');
      qc.invalidateQueries({ queryKey: deviceKeys.all });
      Alert.alert('Saved', 'The Home Bridge picks up the new details within a minute.');
    },
    onError: (err: Error) => Alert.alert('Not saved', err.message),
  });

  if (!device) return <Spinner />;
  const info = BRAND_INFO[device.brand];
  const needsKey = device.brand === 'tuya' || device.brand === 'haier';
  const hasKey = secrets.data?.includes('local_key') ?? false;
  const input = [styles.input, { color: theme.colors.textPrimary }];

  const confirmRemove = () =>
    Alert.alert('Remove this AC?', `${device.name} will disappear from the app and the bridge stops watching it.`, [
      { text: t('common.cancel') || 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => remove.mutate(device.id, { onSuccess: () => navigation.popToTop() }),
      },
    ]);

  return (
    <Screen edges={{ top: true, bottom: true }}>
      <ScreenHeader title={t('settings.title') || 'Settings'} onBack={() => navigation.goBack()} backLabel={t('common.back')} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card padding="lg" style={styles.card}>
          <Row justify="space-between" align="center">
            <View style={styles.flex}>
              <Text variant="heading">{info.label}</Text>
              <Text variant="caption" tone="muted">
                {info.app} app · {info.protocol}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: device.status === 'online' ? theme.colors.success : theme.colors.warning }]}>
              <Text variant="caption" style={styles.badgeText}>
                {device.status === 'online' ? 'Online' : 'Offline'}
              </Text>
            </View>
          </Row>
          {device.status === 'offline' && device.lastError ? (
            <>
              <Spacer size="sm" />
              <Text variant="caption" tone="warning">
                {device.lastError}
              </Text>
            </>
          ) : null}
        </Card>

        <Spacer size="xl" />
        <Text variant="overline" tone="muted">
          Name and room
        </Text>
        <Spacer size="sm" />
        <TextInput value={name} onChangeText={setName} placeholder="AC name" placeholderTextColor={theme.colors.textMuted} style={input} />
        <Spacer size="sm" />
        <Row gap="xs" wrap>
          {ROOMS.map(r => {
            const selected = room === r;
            return (
              <Pressable key={r} onPress={() => setRoom(r)} style={[styles.chip, selected && { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }]}>
                <Text variant="caption" style={{ color: selected ? theme.colors.onAccent : theme.colors.textSecondary }}>
                  {r}
                </Text>
              </Pressable>
            );
          })}
        </Row>
        <Spacer size="md" />
        <Button
          label="Save name and room"
          variant="secondary"
          fullWidth
          loading={rename.isPending}
          disabled={!name.trim()}
          onPress={() => rename.mutate({ id: device.id, patch: { name: name.trim(), roomName: room } })}
        />

        <Spacer size="xl" />
        <Text variant="overline" tone="muted">
          Connection
        </Text>
        <Spacer size="sm" />
        <Stack gap="sm">
          <TextInput value={ip} onChangeText={setIp} placeholder="IP address (found automatically)" keyboardType="numeric" placeholderTextColor={theme.colors.textMuted} style={input} />
          {needsKey ? (
            <>
              <TextInput
                value={deviceId}
                onChangeText={setDeviceId}
                placeholder={secrets.data?.includes('device_id') ? 'Device ID saved (type to replace)' : 'Device ID'}
                autoCapitalize="none"
                placeholderTextColor={theme.colors.textMuted}
                style={input}
              />
              <TextInput
                value={localKey}
                onChangeText={setLocalKey}
                placeholder={hasKey ? 'Local key saved (type to replace)' : 'Local key'}
                autoCapitalize="none"
                secureTextEntry
                placeholderTextColor={theme.colors.textMuted}
                style={input}
              />
              <Text variant="caption" tone={hasKey ? 'success' : 'muted'}>
                {hasKey
                  ? 'A local key is saved for this AC.'
                  : device.brand === 'tuya'
                    ? 'No key yet: run “climateking-bridge tuya-sync” on the bridge, or paste it here.'
                    : 'No key yet: run “haismart-keys” on the bridge computer and paste it here.'}
              </Text>
            </>
          ) : (
            <TextInput value={mac} onChangeText={setMac} placeholder="MAC address" autoCapitalize="none" placeholderTextColor={theme.colors.textMuted} style={input} />
          )}
        </Stack>
        <Spacer size="md" />
        <Button label="Save connection" variant="secondary" fullWidth loading={saveConnection.isPending} onPress={() => saveConnection.mutate()} />

        <Spacer size="xl2" />
        <Button label="Remove this AC" variant="danger" fullWidth loading={remove.isPending} onPress={confirmRemove} />
        <Spacer size="xl" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create(theme => ({
  container: { padding: theme.spacing.lg },
  flex: { flex: 1 },
  card: { borderWidth: 1, borderColor: theme.colors.border },
  badge: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xxs, borderRadius: theme.radius.pill },
  badgeText: { color: '#FFFFFF', fontWeight: '700' },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: 15,
    backgroundColor: theme.colors.surface,
  },
}));
