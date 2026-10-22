import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { CheckIcon, WifiIcon } from '../../components/icons';
import { Card, Row, Screen, ScreenHeader, Spacer, Stack } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import { GreeControl, ScanResult } from '../gree/greeControl';
import { AP_PASSWORD, sendHomeWifi } from '../gree/provision';
import { deviceKeys } from './hooks';
import { addDeviceToSupabase } from './supabaseDevicesService';

// Guided first-time setup: get a brand-new AC onto the home Wi-Fi and into the app without
// typing an IP or MAC. Climate King / Gree units are provisioned from this phone; other brands
// are paired in their own app first and then picked up by the Home Bridge.

type Family = 'gree' | 'other';

type OtherBrand = { vendor: string; app: string };

const OTHER_BRANDS: OtherBrand[] = [
  { vendor: 'Kenwood', app: 'AC Freedom' },
  { vendor: 'Hyundai', app: 'Smart Life' },
  { vendor: 'TCL', app: 'TCL Home / Intelligent AC' },
  { vendor: 'Haier', app: 'HaiSmart / hOn' },
];

const ROOMS = ['Living Room', 'Bedroom', 'Office', 'Kitchen', 'Dining Room'];

const GREE_STEPS = ['Setup mode', 'Home Wi-Fi', 'Join the AC', 'Send', 'Find the AC'];

async function openWifiSettings() {
  try {
    if (Platform.OS === 'android') {
      await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      return;
    }
  } catch {
    // fall through to the app settings page
  }
  await Linking.openSettings();
}

export function WifiSetupScreen() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [family, setFamily] = useState<Family | null>(null);
  const [step, setStep] = useState(0);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<ScanResult[] | null>(null);
  const [picked, setPicked] = useState<ScanResult | null>(null);
  const [room, setRoom] = useState(ROOMS[0]);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const input = [styles.input, { color: theme.colors.textPrimary }];

  const back = () => {
    if (family && step > 0) setStep(step - 1);
    else if (family) setFamily(null);
    else navigation.goBack();
  };

  const send = async () => {
    setSending(true);
    try {
      const outcome = await sendHomeWifi(ssid.trim(), password);
      if (outcome === 'accepted') {
        setSent(true);
        setStep(4);
      } else {
        Alert.alert(
          'The AC did not answer',
          'Check that this phone is connected to the AC’s own Wi-Fi (an 8-character name), then try again. If the AC beeped and restarted anyway, continue to the next step.',
          [
            { text: 'Try again', style: 'cancel' },
            { text: 'Continue anyway', onPress: () => setStep(4) },
          ],
        );
      }
    } finally {
      setSending(false);
    }
  };

  // The unit needs up to a minute to join the router after it leaves setup mode.
  const scan = async () => {
    setScanning(true);
    setFound(null);
    try {
      let units: ScanResult[] = [];
      for (let round = 0; round < 4 && !units.length; round += 1) units = await GreeControl.scanForDevices();
      setFound(units);
      if (units.length === 1) setPicked(units[0]);
    } finally {
      setScanning(false);
    }
  };

  const add = async () => {
    if (!picked) return;
    setAdding(true);
    try {
      const bound = await GreeControl.bindDevice(picked.ip, picked.mac);
      await addDeviceToSupabase({
        name: name.trim() || 'Climate King AC',
        vendor: 'Climate King',
        brand: 'gree',
        roomName: room,
        ipAddress: picked.ip,
        macAddress: picked.mac,
        secrets: bound ? { key: bound.key, cipher: bound.protocol } : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: deviceKeys.all });
      Alert.alert('AC added', 'Your AC is ready to use.');
      navigation.navigate('Home');
    } catch (err: any) {
      Alert.alert('Could not add the AC', err?.message || 'Please try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Screen edges={{ top: true, bottom: true }}>
      <ScreenHeader title="Connect a new AC" onBack={back} backLabel={t('common.back')} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {family === null ? (
          <>
            <Text variant="title">Which AC do you have?</Text>
            <Spacer size="xs" />
            <Text variant="bodySm" tone="muted">
              We will walk you through putting it on your home Wi-Fi. No IP or MAC address needed.
            </Text>
            <Spacer size="xl" />
            <Stack gap="sm">
              <Choice title="Climate King or Gree" subtitle="Set up right here in this app" onPress={() => setFamily('gree')} />
              <Choice title="Another brand" subtitle="Kenwood, Hyundai, TCL, Haier" onPress={() => setFamily('other')} />
            </Stack>
          </>
        ) : family === 'other' ? (
          <OtherBrandGuide onDone={() => navigation.navigate('AddDevice')} />
        ) : (
          <>
            <Progress steps={GREE_STEPS} current={step} />
            <Spacer size="xl" />

            {step === 0 ? (
              <StepCard
                title="Put the AC in setup mode"
                lines={[
                  'Plug in the AC and switch it on with the remote.',
                  'Point the remote at the AC and hold MODE and WIFI together for 5 seconds (on some remotes: hold WIFI alone for 10 seconds).',
                  'The AC beeps. Its Wi-Fi light blinks or the display shows “AP”.',
                ]}
                tip="Already set up with another phone? Doing this resets only the Wi-Fi, not your settings."
                action={<Button label="The AC beeped" onPress={() => setStep(1)} fullWidth size="lg" />}
              />
            ) : null}

            {step === 1 ? (
              <StepCard
                title="Your home Wi-Fi"
                lines={['Type the name and password of the Wi-Fi the AC should use.']}
                tip="Use the 2.4 GHz network. ACs cannot join a 5 GHz-only network (names often end in “5G”)."
                action={
                  <Stack gap="sm">
                    <TextInput value={ssid} onChangeText={setSsid} placeholder="Wi-Fi name" autoCapitalize="none" autoCorrect={false} placeholderTextColor={theme.colors.textMuted} style={input} />
                    <TextInput value={password} onChangeText={setPassword} placeholder="Wi-Fi password" autoCapitalize="none" autoCorrect={false} secureTextEntry placeholderTextColor={theme.colors.textMuted} style={input} />
                    <Spacer size="xs" />
                    <Button label="Next" onPress={() => setStep(2)} disabled={!ssid.trim()} fullWidth size="lg" />
                  </Stack>
                }
              />
            ) : null}

            {step === 2 ? (
              <StepCard
                title="Connect this phone to the AC"
                lines={[
                  'Open Wi-Fi settings on this phone.',
                  'Pick the network with an 8-character name made of letters and numbers (for example “c6a9f1e2”).',
                  `Password: ${AP_PASSWORD}`,
                  'If the phone says “No internet”, choose to stay connected. Then come back here.',
                ]}
                action={
                  <Stack gap="sm">
                    <Button label="Open Wi-Fi settings" variant="secondary" onPress={openWifiSettings} fullWidth size="lg" />
                    <Button label="I am connected to the AC" onPress={() => setStep(3)} fullWidth size="lg" />
                  </Stack>
                }
              />
            ) : null}

            {step === 3 ? (
              <StepCard
                title="Send your Wi-Fi to the AC"
                lines={[`The AC will join “${ssid.trim()}”. It beeps and its Wi-Fi light stops blinking.`]}
                action={<Button label={sending ? 'Sending…' : 'Send to AC'} onPress={send} loading={sending} fullWidth size="lg" />}
              />
            ) : null}

            {step === 4 ? (
              <StepCard
                title={sent ? 'Done! Now find your AC' : 'Find your AC'}
                lines={[
                  `Switch this phone back to your home Wi-Fi “${ssid.trim() || 'your Wi-Fi'}”.`,
                  'Wait about 30 seconds, then tap Search.',
                ]}
                action={
                  <Stack gap="sm">
                    <Button label="Open Wi-Fi settings" variant="secondary" onPress={openWifiSettings} fullWidth size="lg" />
                    <Button label={scanning ? 'Searching…' : 'Search'} onPress={scan} loading={scanning} fullWidth size="lg" />
                  </Stack>
                }
              />
            ) : null}

            {step === 4 && found !== null ? (
              <>
                <Spacer size="xl" />
                {found.length ? (
                  <>
                    <Text variant="overline" tone="muted">
                      Found on your Wi-Fi
                    </Text>
                    <Spacer size="sm" />
                    <Stack gap="sm">
                      {found.map(unit => {
                        const selected = picked?.mac === unit.mac;
                        return (
                          <Pressable key={unit.mac} onPress={() => setPicked(unit)} style={[styles.row, selected && { borderColor: theme.colors.accent }]}>
                            <WifiIcon size={20} color={theme.colors.accent} />
                            <View style={styles.flex}>
                              <Text variant="label">Climate King AC</Text>
                              <Text variant="caption" tone="muted">
                                {unit.ip}
                              </Text>
                            </View>
                            {selected ? <CheckIcon size={18} color={theme.colors.accent} /> : null}
                          </Pressable>
                        );
                      })}
                    </Stack>
                    <Spacer size="lg" />
                    <Text variant="overline" tone="muted">
                      Room and name
                    </Text>
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
                    <Spacer size="sm" />
                    <TextInput value={name} onChangeText={setName} placeholder="Climate King AC" placeholderTextColor={theme.colors.textMuted} style={input} />
                    <Spacer size="lg" />
                    <Button label={adding ? 'Adding…' : 'Add AC'} onPress={add} loading={adding} disabled={!picked} fullWidth size="lg" />
                  </>
                ) : (
                  <Card padding="lg" style={styles.card}>
                    <Text variant="label">No AC found yet</Text>
                    <Spacer size="xs" />
                    <Text variant="caption" tone="muted">
                      Check that this phone is back on “{ssid.trim() || 'your Wi-Fi'}” and wait a little longer. If the Wi-Fi light on the AC is still blinking, the password may be wrong: start again from step 1.
                    </Text>
                    <Spacer size="md" />
                    <Button label="Start again" variant="ghost" onPress={() => { setStep(0); setFound(null); setSent(false); }} fullWidth />
                  </Card>
                )}
              </>
            ) : null}
          </>
        )}
        <Spacer size="xl" />
      </ScrollView>
    </Screen>
  );
}

function Choice({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <WifiIcon size={22} color={theme.colors.accent} />
      <View style={styles.flex}>
        <Text variant="heading">{title}</Text>
        <Text variant="caption" tone="muted">
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function Progress({ steps, current }: { steps: string[]; current: number }) {
  const { theme } = useUnistyles();
  return (
    <View>
      <Row gap="xs">
        {steps.map((label, i) => (
          <View key={label} style={[styles.bar, { backgroundColor: i <= current ? theme.colors.accent : theme.colors.border }]} />
        ))}
      </Row>
      <Spacer size="xs" />
      <Text variant="caption" tone="muted">
        Step {current + 1} of {steps.length} · {steps[current]}
      </Text>
    </View>
  );
}

function StepCard({ title, lines, tip, action }: { title: string; lines: string[]; tip?: string; action: React.ReactNode }) {
  return (
    <Card padding="lg" style={styles.card}>
      <Text variant="title">{title}</Text>
      <Spacer size="md" />
      <Stack gap="sm">
        {lines.map((line, i) => (
          <Row key={line} gap="sm" align="flex-start">
            <Text variant="label" tone="brand">
              {i + 1}.
            </Text>
            <Text variant="bodySm" style={styles.flex}>
              {line}
            </Text>
          </Row>
        ))}
      </Stack>
      {tip ? (
        <>
          <Spacer size="md" />
          <Text variant="caption" tone="muted">
            {tip}
          </Text>
        </>
      ) : null}
      <Spacer size="lg" />
      {action}
    </Card>
  );
}

function OtherBrandGuide({ onDone }: { onDone: () => void }) {
  return (
    <>
      <StepCard
        title="Pair it in the brand’s app first"
        lines={[
          'Install the AC’s own app (see the list below) and add the AC there, on your 2.4 GHz home Wi-Fi.',
          'Check that you can switch the AC on and off in that app.',
          'Keep the Home Bridge running at home. It finds the AC on your Wi-Fi within a few minutes.',
          'Open Add AC and tap the unit under “Found on your Wi-Fi”.',
        ]}
        action={<Button label="Go to Add AC" onPress={onDone} fullWidth size="lg" />}
      />
      <Spacer size="lg" />
      <Stack gap="xs">
        {OTHER_BRANDS.map(b => (
          <Row key={b.vendor} justify="space-between">
            <Text variant="label">{b.vendor}</Text>
            <Text variant="caption" tone="muted">
              {b.app} app
            </Text>
          </Row>
        ))}
      </Stack>
    </>
  );
}

const styles = StyleSheet.create(theme => ({
  container: { padding: theme.spacing.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  card: { borderWidth: 1, borderColor: theme.colors.border },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
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
