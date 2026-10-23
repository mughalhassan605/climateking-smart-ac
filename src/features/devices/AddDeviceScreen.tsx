import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { CheckIcon, WifiIcon } from '../../components/icons';
import { Card, Row, Screen, ScreenHeader, Spacer, Stack } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import { deviceKeys, useBridges, useDiscoveredDevices } from './hooks';
import { PhoneFound, scanAllFromPhone } from './lanScan';
import { addDeviceToSupabase, DiscoveredDevice } from './supabaseDevicesService';
import { Brand } from './types';

type BrandOption = {
  key: string;
  vendor: string;
  brand: Brand;
  app: string;
  /** What the form asks for besides name and room. */
  needs: 'mac' | 'tuya' | 'haier';
};

const BRANDS: BrandOption[] = [
  { key: 'climateking', vendor: 'Climate King', brand: 'gree', app: 'Gree+ / EWPE Smart app', needs: 'mac' },
  { key: 'gree', vendor: 'Gree', brand: 'gree', app: 'Gree+ app', needs: 'mac' },
  { key: 'kenwood', vendor: 'Kenwood', brand: 'broadlink', app: 'AC Freedom app', needs: 'mac' },
  { key: 'hyundai', vendor: 'Hyundai', brand: 'tuya', app: 'Smart Life app', needs: 'tuya' },
  { key: 'tcl', vendor: 'TCL', brand: 'tcl', app: 'Intelligent AC app', needs: 'mac' },
  { key: 'tcl-smartlife', vendor: 'TCL', brand: 'tuya', app: 'TCL SmartLife app', needs: 'tuya' },
  { key: 'haier', vendor: 'Haier', brand: 'haier', app: 'HaiSmart / U+ app', needs: 'haier' },
];

const ROOMS = ['Living Room', 'Bedroom', 'Office', 'Kitchen', 'Dining Room'];

const BRAND_LABEL: Record<Brand, string> = {
  gree: 'Gree / Climate King',
  broadlink: 'Kenwood (AC Freedom)',
  tcl: 'TCL',
  tuya: 'Smart Life (Hyundai / TCL)',
  haier: 'Haier',
};

export function AddDeviceScreen() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const bridges = useBridges();
  const discovered = useDiscoveredDevices();
  const bridgeOnline = (bridges.data ?? []).some(b => b.online);

  const [option, setOption] = useState<BrandOption>(BRANDS[0]);
  const [name, setName] = useState('');
  const [room, setRoom] = useState(ROOMS[0]);
  const [ip, setIp] = useState('');
  const [mac, setMac] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [localKey, setLocalKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [phoneFound, setPhoneFound] = useState<PhoneFound[] | null>(null);

  const pickFound = (found: DiscoveredDevice) => {
    const match = BRANDS.find(b => b.brand === found.brand) ?? BRANDS[0];
    setOption(match);
    setIp(found.ipAddress);
    setMac(found.brand === 'tuya' || found.brand === 'haier' ? '' : found.macAddress);
    setDeviceId(String(found.details.device_id ?? ''));
    setName(found.name ?? '');
  };

  const pickPhoneFound = (found: PhoneFound) => {
    const match = BRANDS.find(b => b.brand === found.brand) ?? BRANDS[0];
    setOption(match);
    setIp(found.ip);
    setMac(match.needs === 'mac' ? found.mac : '');
    setDeviceId(found.deviceId ?? (match.needs !== 'mac' ? found.mac : ''));
    setName(found.name ?? '');
  };

  // Scan from this phone for every brand (it must be on the same Wi-Fi as the ACs), and ask the
  // Home Bridge's list again in case it found something since this screen opened.
  const scanFromPhone = async () => {
    setScanning(true);
    try {
      const [units] = await Promise.all([
        scanAllFromPhone(),
        discovered.refetch().catch(() => ({ data: [] })),
      ]);
      setPhoneFound(units);
      if (units.length === 1) {
        pickPhoneFound(units[0]);
        Alert.alert(
          'AC Found!',
          `Found 1 ${BRAND_LABEL[units[0].brand]} unit at ${units[0].ip}.\n\nThe connection details have been filled in below.`,
        );
      } else if (units.length > 1) {
        Alert.alert(
          'ACs Found!',
          `Found ${units.length} units on your Wi-Fi.\n\nPlease tap on your unit in the "Found by this phone" list below to select it.`,
        );
      } else {
        Alert.alert(
          'No AC Found',
          'No air conditioner responded on your local Wi-Fi.\n\nPlease make sure:\n1. The AC is switched ON.\n2. Your phone and the AC are connected to the same 2.4 GHz Wi-Fi network.\n3. If your AC is new, tap "New AC? Connect it to Wi-Fi" above.',
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Scan Error',
        `Could not complete the Wi-Fi scan: ${err?.message || 'Network error'}. Please check your Wi-Fi connection and try again.`,
      );
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    const vendor = option.vendor;
    const cleanMac = mac.toLowerCase().replace(/[^0-9a-f]/g, '');
    if (option.needs === 'mac' && cleanMac.length !== 12) {
      Alert.alert('MAC address needed', 'Enter the AC’s MAC address (12 characters), or pick it from the list found by the Home Bridge.');
      return;
    }
    setSaving(true);
    try {
      await addDeviceToSupabase({
        name: name.trim() || `${vendor} AC`,
        vendor,
        brand: option.brand,
        roomName: room,
        ipAddress: ip,
        macAddress: cleanMac,
        cloudId: option.needs === 'tuya' ? deviceId : undefined,
        secrets:
          option.needs === 'tuya' || option.needs === 'haier'
            ? { device_id: deviceId.trim(), local_key: localKey.trim() }
            : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: deviceKeys.all });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Could not add the AC', err?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const input = [styles.input, { color: theme.colors.textPrimary }];
  const foundList = discovered.data ?? [];

  return (
    <Screen edges={{ top: true, bottom: true }}>
      <ScreenHeader title={t('devices.addDevice') || 'Add AC'} onBack={() => navigation.goBack()} backLabel={t('common.back')} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card padding="lg" style={styles.bridgeCard}>
          <Row gap="md" align="center">
            <View style={[styles.dot, { backgroundColor: bridgeOnline ? theme.colors.success : theme.colors.warning }]} />
            <View style={styles.flex}>
              <Text variant="heading">{bridgeOnline ? 'Home Bridge online' : 'Home Bridge offline'}</Text>
              <Text variant="caption" tone="muted">
                {bridgeOnline
                  ? 'ACs on your home Wi-Fi are found automatically and can be controlled from anywhere.'
                  : 'Start the bridge on a PC, Raspberry Pi or spare phone at home (see bridge/README.md).'}
              </Text>
            </View>
          </Row>
        </Card>

        <Spacer size="md" />
        <Pressable onPress={() => navigation.navigate('WifiSetup')} style={({ pressed }) => [styles.foundRow, styles.setupRow, pressed && styles.pressed]}>
          <WifiIcon size={22} color={theme.colors.accent} />
          <View style={styles.flex}>
            <Text variant="label">New AC? Connect it to Wi-Fi</Text>
            <Text variant="caption" tone="muted">
              Step-by-step guide, no IP or MAC needed
            </Text>
          </View>
          <Text variant="label" tone="brand">
            Start
          </Text>
        </Pressable>

        <Spacer size="md" />
        <Button label={scanning ? 'Scanning your Wi-Fi…' : 'Scan for ACs'} onPress={scanFromPhone} loading={scanning} variant="secondary" fullWidth size="lg" />
        <Spacer size="xs" />
        <Text variant="caption" tone="muted" center>
          Finds Climate King, Gree, Kenwood, TCL, Smart Life (Hyundai) and Haier units on this Wi-Fi.
        </Text>

        {phoneFound?.length ? (
          <>
            <Spacer size="xl" />
            <Text variant="overline" tone="muted">
              Found by this phone
            </Text>
            <Spacer size="sm" />
            <Stack gap="sm">
              {phoneFound.map(found => (
                <Pressable key={`${found.brand}:${found.mac}`} onPress={() => pickPhoneFound(found)} style={({ pressed }) => [styles.foundRow, pressed && styles.pressed]}>
                  <WifiIcon size={20} color={theme.colors.accent} />
                  <View style={styles.flex}>
                    <Text variant="label">{found.name || BRAND_LABEL[found.brand]}</Text>
                    <Text variant="caption" tone="muted">
                      {BRAND_LABEL[found.brand]} · {found.ip}
                      {found.brand === 'tuya' ? ' · key needed' : ''}
                    </Text>
                  </View>
                  <Text variant="label" tone="brand">
                    Use
                  </Text>
                </Pressable>
              ))}
            </Stack>
          </>
        ) : null}

        {foundList.length ? (
          <>
            <Spacer size="xl" />
            <Text variant="overline" tone="muted">
              Found by the Home Bridge
            </Text>
            <Spacer size="sm" />
            <Stack gap="sm">
              {foundList.map(found => (
                <Pressable key={found.id} onPress={() => pickFound(found)} style={({ pressed }) => [styles.foundRow, pressed && styles.pressed]}>
                  <WifiIcon size={20} color={theme.colors.accent} />
                  <View style={styles.flex}>
                    <Text variant="label">{found.name || BRAND_LABEL[found.brand]}</Text>
                    <Text variant="caption" tone="muted">
                      {BRAND_LABEL[found.brand]} · {found.ipAddress}
                      {found.needsKey ? ' · key needed' : ''}
                    </Text>
                  </View>
                  <Text variant="label" tone="brand">
                    Use
                  </Text>
                </Pressable>
              ))}
            </Stack>
          </>
        ) : null}

        <Spacer size="xl" />
        <Text variant="overline" tone="muted">
          1 · Brand
        </Text>
        <Spacer size="sm" />
        <View style={styles.brandGrid}>
          {BRANDS.map(b => {
            const selected = option.key === b.key;
            return (
              <Pressable
                key={b.key}
                onPress={() => setOption(b)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.brandCard, selected && { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceElevated }]}
              >
                <Row justify="space-between" align="center">
                  <Text variant="label">{b.vendor}</Text>
                  {selected ? <CheckIcon size={16} color={theme.colors.accent} /> : null}
                </Row>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {b.app}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Spacer size="xl" />
        <Text variant="overline" tone="muted">
          2 · Room and name
        </Text>
        <Spacer size="sm" />
        <Row gap="xs" wrap>
          {ROOMS.map(r => {
            const selected = room === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRoom(r)}
                style={[styles.chip, selected && { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }]}
              >
                <Text variant="caption" style={{ color: selected ? theme.colors.onAccent : theme.colors.textSecondary }}>
                  {r}
                </Text>
              </Pressable>
            );
          })}
        </Row>
        <Spacer size="sm" />
        <TextInput value={name} onChangeText={setName} placeholder={`${option.vendor} AC`} placeholderTextColor={theme.colors.textMuted} style={input} />

        <Spacer size="xl" />
        <Row justify="space-between" align="center">
          <Text variant="overline" tone="muted">
            3 · Connection
          </Text>
        </Row>
        <Spacer size="sm" />
        <Stack gap="sm">
          <TextInput value={ip} onChangeText={setIp} placeholder="IP address, e.g. 192.168.1.40 (optional)" keyboardType="numeric" placeholderTextColor={theme.colors.textMuted} style={input} />
          {option.needs === 'mac' ? (
            <TextInput value={mac} onChangeText={setMac} placeholder="MAC address, e.g. f4:91:1e:5a:0c:01" autoCapitalize="none" placeholderTextColor={theme.colors.textMuted} style={input} />
          ) : (
            <>
              <TextInput value={deviceId} onChangeText={setDeviceId} placeholder={option.needs === 'tuya' ? 'Tuya device ID' : 'Haier device ID (MAC)'} autoCapitalize="none" placeholderTextColor={theme.colors.textMuted} style={input} />
              <TextInput value={localKey} onChangeText={setLocalKey} placeholder="Local key (optional)" autoCapitalize="none" secureTextEntry placeholderTextColor={theme.colors.textMuted} style={input} />
              <Text variant="caption" tone="muted">
                {option.needs === 'tuya'
                  ? 'Leave the key empty and run “climateking-bridge tuya-sync” on the bridge: it fetches every Smart Life key for you.'
                  : 'Get the key with “haismart-keys” on the bridge computer, using the Haier account the AC is paired with.'}
              </Text>
            </>
          )}
        </Stack>

        <Spacer size="xl2" />
        <Button label={saving ? 'Adding…' : 'Add AC'} onPress={save} loading={saving} fullWidth size="lg" />
        <Spacer size="xl" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create(theme => ({
  container: { padding: theme.spacing.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  bridgeCard: { borderWidth: 1, borderColor: theme.colors.border },
  setupRow: { borderColor: theme.colors.accent, borderWidth: 1.5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  foundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  brandCard: {
    width: '48.5%',
    padding: theme.spacing.md,
    gap: theme.spacing.xxs,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
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
