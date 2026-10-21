import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import dgram from 'react-native-udp';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { Screen, ScreenHeader, Spacer, Stack, Row, Card } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import { deviceKeys } from './hooks';
import { addDeviceToSupabase } from './supabaseDevicesService';
import { Brand } from './types';

const BROADCASTS = [
  '255.255.255.255',
  '192.168.88.255',
  '192.168.0.255',
  '192.168.1.255',
  '192.168.2.255',
  '192.168.8.255',
  '192.168.10.255',
  '192.168.100.255',
  '10.0.0.255',
];

type FoundDevice = {
  ip: string;
  proto: 'Gree' | 'Tuya' | 'Haier';
  detail: string;
};

const BRANDS = [
  { name: 'Climate King', brand: 'gree' as Brand, desc: 'Gree Protocol (Port 7000)' },
  { name: 'Gree', brand: 'gree' as Brand, desc: 'Gree Protocol (Port 7000)' },
  { name: 'Kenwood', brand: 'tuya' as Brand, desc: 'Tuya SmartLife (TCP 6668)' },
  { name: 'Haier', brand: 'haier' as Brand, desc: 'Haier SmartAir / hOn (Port 56800)' },
  { name: 'Hyundai', brand: 'tuya' as Brand, desc: 'Tuya SmartLife (TCP 6668)' },
];

const ROOMS = ['Living Room', 'Bedroom', 'Office', 'Kitchen', 'Dining Room'];

export function AddDeviceScreen() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'scan' | 'manual'>('manual');

  // Manual Form States
  const [selectedBrand, setSelectedBrand] = useState(BRANDS[0]);
  const [deviceName, setDeviceName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
  const [ipAddress, setIpAddress] = useState('');
  const [localKey, setLocalKey] = useState('');
  const [saving, setSaving] = useState(false);

  // Scan States
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<Record<string, FoundDevice>>({});
  const socketsRef = useRef<any[]>([]);
  const intervalsRef = useRef<any[]>([]);
  const timeoutRef = useRef<any>(null);

  const stopScan = useCallback(() => {
    // 1. Clear any pending timeouts and repeat intervals first
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    intervalsRef.current.forEach(iv => {
      try {
        clearInterval(iv);
      } catch {}
    });
    intervalsRef.current = [];

    // 2. Safely close all active sockets without stripping error listener first
    const sockets = [...socketsRef.current];
    socketsRef.current = [];

    sockets.forEach(s => {
      try {
        // Keep an error listener attached so close errors never throw uncaught EventEmitter error
        s.on?.('error', () => {});
        s.close?.(() => {});
      } catch {}
    });

    setScanning(false);
  }, []);

  // Cleanup on unmount so scanning never leaks across screens
  React.useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  const startScan = useCallback(() => {
    stopScan();
    setDiscovered({});
    setScanning(true);

    try {
      // 1. Gree UDP broadcast scan
      const gree: any = dgram.createSocket({ type: 'udp4', reusePort: true });
      
      // Always attach error listener FIRST to prevent unhandled EventEmitter crash
      gree.on('error', (err: any) => {
        console.warn('Gree UDP socket non-fatal error:', err?.message);
      });

      gree.on('message', (msg: any, rinfo: { address: string }) => {
        try {
          if (!rinfo?.address) return;
          const d = JSON.parse(msg.toString());
          if (d && (d.t === 'pack' || d.t === 'dev')) {
            setDiscovered(prev => {
              if (prev[rinfo.address]) return prev;
              return {
                ...prev,
                [rinfo.address]: {
                  ip: rinfo.address,
                  proto: 'Gree',
                  detail: `Gree/Climate King (cid=${d.cid || ''})`,
                },
              };
            });
          }
        } catch {}
      });

      try {
        gree.bind(0, (bindErr: any) => {
          if (bindErr) {
            console.warn('Gree bind error:', bindErr?.message);
            return;
          }
          try {
            gree.setBroadcast?.(true);
          } catch {}
          const ping = JSON.stringify({ t: 'scan' });
          const blast = () => {
            try {
              BROADCASTS.forEach(a => {
                try {
                  gree.send(ping, undefined, undefined, 7000, a, () => {});
                  gree.send(ping, undefined, undefined, 56800, a, () => {});
                } catch {}
              });
            } catch {}
          };
          blast();
          const iv = setInterval(blast, 2000);
          intervalsRef.current.push(iv);
        });
      } catch (bindErr) {
        console.warn('Gree bind call error:', bindErr);
      }
      socketsRef.current.push(gree);

      // 2. Tuya UDP listeners (6666 & 6667) for Kenwood, Hyundai & Tuya ACs
      [6666, 6667].forEach(port => {
        try {
          const tuya: any = dgram.createSocket({ type: 'udp4', reusePort: true });

          // Catch any error immediately so it never causes process crash
          tuya.on('error', (err: any) => {
            console.warn(`Tuya UDP ${port} non-fatal error:`, err?.message);
          });

          tuya.on('message', (_msg: any, rinfo: { address: string }) => {
            try {
              if (!rinfo?.address) return;
              setDiscovered(prev => {
                if (prev[rinfo.address]) return prev;
                return {
                  ...prev,
                  [rinfo.address]: {
                    ip: rinfo.address,
                    proto: 'Tuya',
                    detail: `Kenwood/Tuya Unit (UDP ${port})`,
                  },
                };
              });
            } catch {}
          });

          try {
            tuya.bind(port, (bindErr: any) => {
              if (bindErr) {
                console.warn(`Tuya bind to port ${port} had error:`, bindErr?.message);
              }
            });
          } catch (bErr) {
            console.warn(`Tuya bind call failed on port ${port}:`, bErr);
          }
          socketsRef.current.push(tuya);
        } catch (sockErr) {
          console.warn(`Could not create Tuya socket on ${port}:`, sockErr);
        }
      });

      // 3. Haier SmartAir UDP listener (Port 56800)
      try {
        const haier: any = dgram.createSocket({ type: 'udp4', reusePort: true });
        haier.on('error', (err: any) => {
          console.warn('Haier UDP 56800 non-fatal error:', err?.message);
        });
        haier.on('message', (_msg: any, rinfo: { address: string }) => {
          try {
            if (!rinfo?.address) return;
            setDiscovered(prev => {
              if (prev[rinfo.address]) return prev;
              return {
                ...prev,
                [rinfo.address]: {
                  ip: rinfo.address,
                  proto: 'Haier',
                  detail: 'Haier SmartAir Unit (UDP 56800)',
                },
              };
            });
          } catch {}
        });
        try {
          haier.bind(56800, (bErr: any) => {
            if (bErr) console.warn('Haier bind 56800 error:', bErr?.message);
          });
        } catch (hbErr) {
          console.warn('Haier bind call failed:', hbErr);
        }
        socketsRef.current.push(haier);
      } catch (hErr) {
        console.warn('Could not create Haier socket:', hErr);
      }

      // Automatically stop scan after 12 seconds
      timeoutRef.current = setTimeout(() => {
        stopScan();
      }, 12000);
    } catch (globalErr) {
      console.warn('Scan start error:', globalErr);
      stopScan();
    }
  }, [stopScan]);

  const handleSave = async (params?: {
    name?: string;
    vendor?: string;
    brand?: Brand;
    ip?: string;
  }) => {
    const finalVendor = params?.vendor || selectedBrand.name;
    const finalBrand = params?.brand || selectedBrand.brand;
    const finalName = params?.name || deviceName || `${finalVendor} AC`;
    const finalIp = params?.ip || ipAddress;

    setSaving(true);
    try {
      await addDeviceToSupabase({
        name: finalName,
        vendor: finalVendor,
        brand: finalBrand,
        model: `${finalVendor} Wi-Fi`,
        roomName: selectedRoom,
        ipAddress: finalIp,
        localKey: localKey,
      });

      // Invalidate queries so dashboard refreshes with new device immediately
      await queryClient.invalidateQueries({ queryKey: deviceKeys.all });
      Alert.alert('Device Added', `${finalName} has been saved to your dashboard.`);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save device to database.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={{ top: true, bottom: true }}>
      <ScreenHeader
        title={t('devices.addDevice') || 'Add Wi-Fi AC'}
        onBack={() => {
          stopScan();
          navigation.goBack();
        }}
        backLabel={t('common.back')}
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Tab Selector */}
        <Row gap="sm" style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, tab === 'manual' && styles.tabButtonActive]}
            onPress={() => setTab('manual')}
          >
            <Text
              variant="label"
              style={{ color: tab === 'manual' ? theme.colors.onPrimary : theme.colors.textSecondary }}
            >
              Manual Setup
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, tab === 'scan' && styles.tabButtonActive]}
            onPress={() => setTab('scan')}
          >
            <Text
              variant="label"
              style={{ color: tab === 'scan' ? theme.colors.onPrimary : theme.colors.textSecondary }}
            >
              Auto Wi-Fi Scan
            </Text>
          </Pressable>
        </Row>

        <Spacer size="md" />

        {tab === 'manual' ? (
          <Stack gap="lg">
            {/* Brand Selection */}
            <View>
              <Text variant="heading">1. Select AC Brand</Text>
              <Spacer size="xs" />
              <Row gap="sm" wrap>
                {BRANDS.map(b => {
                  const isSelected = selectedBrand.name === b.name;
                  return (
                    <Pressable
                      key={b.name}
                      onPress={() => setSelectedBrand(b)}
                      style={[
                        styles.chip,
                        isSelected && {
                          borderColor: theme.colors.primary,
                          backgroundColor: theme.colors.surfaceElevated,
                        },
                      ]}
                    >
                      <Text
                        variant="body"
                        style={{
                          fontWeight: isSelected ? '700' : '400',
                          color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                        }}
                      >
                        {b.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </Row>
              <Spacer size="xs" />
              <Text variant="caption" style={{ color: theme.colors.textMuted }}>
                Protocol: {selectedBrand.desc}
              </Text>
            </View>

            {/* Room Selection */}
            <View>
              <Text variant="heading">2. Assign Room</Text>
              <Spacer size="xs" />
              <Row gap="xs" wrap>
                {ROOMS.map(r => {
                  const isSelected = selectedRoom === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setSelectedRoom(r)}
                      style={[
                        styles.chip,
                        isSelected && {
                          borderColor: theme.colors.primary,
                          backgroundColor: theme.colors.surfaceElevated,
                        },
                      ]}
                    >
                      <Text
                        variant="bodySm"
                        style={{
                          fontWeight: isSelected ? '600' : '400',
                          color: isSelected ? theme.colors.primary : theme.colors.textSecondary,
                        }}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  );
                })}
              </Row>
            </View>

            {/* Device Name */}
            <View>
              <Text variant="heading">3. Device Details</Text>
              <Spacer size="xs" />
              <TextInput
                value={deviceName}
                onChangeText={setDeviceName}
                placeholder={`e.g. ${selectedBrand.name} Master AC`}
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              />

              <Spacer size="sm" />
              <Text variant="label">Wi-Fi IP Address</Text>
              <Spacer size="xs" />
              <TextInput
                value={ipAddress}
                onChangeText={setIpAddress}
                placeholder="e.g. 192.168.1.150"
                keyboardType="numeric"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              />

              {selectedBrand.brand === 'tuya' ? (
                <>
                  <Spacer size="sm" />
                  <Text variant="label">Local Key / Token (Optional for Tuya)</Text>
                  <Spacer size="xs" />
                  <TextInput
                    value={localKey}
                    onChangeText={setLocalKey}
                    placeholder="16-character local key (from SmartLife)"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  />
                </>
              ) : null}
            </View>

            <Spacer size="md" />

            <Button
              label={saving ? 'Saving...' : 'Save & Connect to Dashboard'}
              onPress={() => handleSave()}
              loading={saving}
              fullWidth
            />
          </Stack>
        ) : (
          <Stack gap="lg">
            <Card padding="md">
              <Text variant="heading">Wi-Fi Network Scanner</Text>
              <Spacer size="xs" />
              <Text variant="bodySm" style={{ color: theme.colors.textSecondary }}>
                Ensure your phone is connected to your home 2.4 GHz Wi-Fi and the AC is powered ON.
              </Text>
              <Spacer size="md" />
              <Button
                label={scanning ? 'Scanning Network...' : 'Start Scan'}
                onPress={scanning ? stopScan : startScan}
                variant={scanning ? 'secondary' : 'primary'}
                loading={scanning}
                fullWidth
              />
            </Card>

            <View>
              <Text variant="heading">Discovered Devices ({Object.keys(discovered).length})</Text>
              <Spacer size="sm" />
              {Object.keys(discovered).length === 0 ? (
                <Text variant="bodySm" style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 24 }}>
                  {scanning ? 'Listening for Wi-Fi broadcasts...' : 'No devices found yet. Tap "Start Scan" above.'}
                </Text>
              ) : (
                Object.values(discovered).map(item => (
                  <Card key={item.ip} style={{ marginBottom: 12 }} padding="md">
                    <Row justify="space-between" align="center">
                      <View style={{ flex: 1 }}>
                        <Text variant="heading">{item.proto} AC Unit</Text>
                        <Text variant="caption" style={{ color: theme.colors.textMuted }}>
                          IP: {item.ip} | {item.detail}
                        </Text>
                      </View>
                      <Button
                        label="+ Add"
                        size="sm"
                        onPress={() =>
                          handleSave({
                            vendor: item.proto,
                            brand: item.proto === 'Gree' ? 'gree' : item.proto === 'Haier' ? 'haier' : 'tuya',
                            name: `${item.proto} AC (${item.ip.split('.').slice(-1)[0]})`,
                            ip: item.ip,
                          })
                        }
                      />
                    </Row>
                  </Card>
                ))
              )}
            </View>
          </Stack>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    padding: theme.spacing.lg,
  },
  tabRow: {
    backgroundColor: theme.colors.surface,
    padding: 4,
    borderRadius: theme.radius.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.radius.sm,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  input: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
  },
}));
