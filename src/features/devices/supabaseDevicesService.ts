import { env } from '../../config/env';
import { supabase } from '../../config/supabase';
import { logger } from '../../lib/logger';
import { GreeSecrets, readGreeOnLan, sendGreeOnLan } from '../gree/greeLan';
import { DevicePatch, DevicesService } from './mockDevices';
import { Brand, DEFAULT_AIRFLOW, Device } from './types';

// How the app reaches an AC, in order:
//   1. The Home Bridge (bridge/), when one is online: the app queues a command in
//      device_commands and the bridge runs it on the home LAN. Works from anywhere.
//   2. No bridge, Gree / Climate King unit, phone on the home Wi-Fi: the phone talks to the unit.
//   3. No bridge, Tuya unit with a cloud id: the tuya-cloud function sends it through Tuya's cloud.
// Live state comes back through the devices row, which the bridge keeps up to date.

/** A row the bridge has not refreshed for this long is shown offline even if it says online. */
const STALE_AFTER_MS = 90_000;
const COMMAND_WAIT_MS = 12_000;
const LAN_RETRY_AFTER_MS = 60_000;

export class CommandError extends Error {}

type Row = Record<string, any>;

function isFresh(iso?: string | null, maxAgeMs = STALE_AFTER_MS) {
  return !!iso && Date.now() - Date.parse(iso) < maxAgeMs;
}

function mapRowToDevice(row: Row): Device {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id || 'room-living',
    roomName: row.room_name || 'Living Room',
    model: row.model || 'Wi-Fi AC',
    brand: (row.brand as Brand) || 'gree',
    vendor: row.vendor || 'Climate King',
    status: row.status === 'online' && isFresh(row.last_seen) ? 'online' : 'offline',
    isOn: Boolean(row.is_on),
    mode: row.mode || 'cool',
    targetTemp: Number(row.target_temp) || 24,
    currentTemp: Number(row.current_temp) || 0,
    humidity: Number(row.humidity) || 0,
    fanSpeed: row.fan_speed || 'auto',
    airflow: row.airflow || DEFAULT_AIRFLOW,
    features: row.features || ['eco', 'sleep', 'turbo', 'swing'],
    lastError: row.last_error ?? null,
    ipAddress: row.ip_address || undefined,
    macAddress: row.mac_address || undefined,
  };
}

function rowFromDevice(device: Device): Row {
  return {
    is_on: device.isOn,
    mode: device.mode,
    target_temp: device.targetTemp,
    current_temp: device.currentTemp || null,
    fan_speed: device.fanSpeed,
    airflow: device.airflow,
    status: 'online',
    last_seen: new Date().toISOString(),
    last_error: null,
  };
}

export type BridgeInfo = { id: string; name: string; lastSeen: string; online: boolean };

export async function fetchBridges(): Promise<BridgeInfo[]> {
  const { data, error } = await supabase.from('bridges').select('id,name,last_seen').order('last_seen', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(b => ({
    id: b.id,
    name: b.name,
    lastSeen: b.last_seen,
    online: isFresh(b.last_seen, env.BRIDGE_ONLINE_SECONDS * 1000),
  }));
}

async function bridgeOnline(): Promise<boolean> {
  try {
    return (await fetchBridges()).some(b => b.online);
  } catch {
    return false;
  }
}

async function readSecrets(deviceId: string): Promise<Record<string, any>> {
  const { data } = await supabase.from('device_secrets').select('secrets').eq('device_id', deviceId).maybeSingle();
  return (data?.secrets as Record<string, any>) ?? {};
}

async function saveSecrets(deviceId: string, secrets: Record<string, any>) {
  await supabase.from('device_secrets').upsert({ device_id: deviceId, secrets }, { onConflict: 'device_id' });
}

async function finishCommand(id: number, status: 'done' | 'failed', executedBy: string, error: string | null = null) {
  await supabase
    .from('device_commands')
    .update({ status, error, executed_by: executedBy, executed_at: new Date().toISOString() })
    .eq('id', id);
}

/** Wait until the bridge reports the command's outcome, or the timeout passes (then assume it is on its way). */
async function waitForCommand(id: number): Promise<{ status: string; error: string | null }> {
  const deadline = Date.now() + COMMAND_WAIT_MS;
  let last = { status: 'pending', error: null as string | null };
  while (Date.now() < deadline) {
    const { data } = await supabase.from('device_commands').select('status,error').eq('id', id).single();
    if (data) last = data;
    if (last.status !== 'pending' && last.status !== 'running') return last;
    await new Promise<void>(resolve => setTimeout(resolve, 500));
  }
  return last;
}

export function createSupabaseDevicesService(): DevicesService {
  let cachedDevices: Device[] = [];
  const lanBackoff = new Map<string, number>();

  // With no bridge running, the phone keeps Gree units fresh itself while it is on their Wi-Fi.
  async function refreshOverLan(device: Device): Promise<Device> {
    if (device.brand !== 'gree' || (lanBackoff.get(device.id) ?? 0) > Date.now()) return device;
    const secrets = (await readSecrets(device.id)) as GreeSecrets;
    const lan = await readGreeOnLan(device, secrets).catch(() => null);
    if (!lan) {
      lanBackoff.set(device.id, Date.now() + LAN_RETRY_AFTER_MS);
      return device;
    }
    lanBackoff.delete(device.id);
    await supabase
      .from('devices')
      .update({ ...rowFromDevice(lan.value), ip_address: lan.ip })
      .eq('id', device.id);
    if (lan.secrets.key !== secrets.key) await saveSecrets(device.id, { ...secrets, ...lan.secrets });
    return { ...lan.value, ipAddress: lan.ip };
  }

  async function runWithoutBridge(device: Device, commandId: number, patch: DevicePatch): Promise<Device> {
    if (device.brand === 'gree') {
      const secrets = (await readSecrets(device.id)) as GreeSecrets;
      const lan = await sendGreeOnLan(device, secrets, patch).catch(() => null);
      if (lan) {
        await finishCommand(commandId, 'done', 'phone-lan');
        await supabase
          .from('devices')
          .update({ ...rowFromDevice(lan.value), ip_address: lan.ip })
          .eq('id', device.id);
        if (lan.secrets.key !== secrets.key) await saveSecrets(device.id, { ...secrets, ...lan.secrets });
        return lan.value;
      }
      const message = 'The Home Bridge is offline and the AC did not answer on this Wi-Fi.';
      await finishCommand(commandId, 'failed', 'phone-lan', message);
      throw new CommandError(message);
    }
    if (device.brand === 'tuya') {
      const { data, error } = await supabase.functions.invoke('tuya-cloud', { body: { commandId } });
      if (error) {
        let message = 'Tuya cloud could not reach the AC.';
        try {
          message = (await error.context.json()).error ?? message;
        } catch {}
        throw new CommandError(message);
      }
      if (data?.ok) return { ...device, ...patch };
    }
    const message = 'The Home Bridge is offline. Start it at home to control this AC.';
    await finishCommand(commandId, 'failed', 'app', message);
    throw new CommandError(message);
  }

  return {
    async getDevices(): Promise<Device[]> {
      const { data, error } = await supabase.from('devices').select('*').order('created_at', { ascending: true });
      if (error) {
        console.warn('Supabase fetch failed, using cache:', error);
        return cachedDevices;
      }
      let devices = (data || []).map(mapRowToDevice);
      if (devices.some(d => d.brand === 'gree' && d.status === 'offline') && !(await bridgeOnline())) {
        devices = await Promise.all(devices.map(d => (d.status === 'offline' ? refreshOverLan(d) : d)));
      }
      cachedDevices = devices;
      return devices;
    },

    async getDevice(id: string): Promise<Device> {
      const { data, error } = await supabase.from('devices').select('*').eq('id', id).single();
      if (error || !data) {
        const fallback = cachedDevices.find(d => d.id === id);
        if (!fallback) throw new Error('Device not found');
        return fallback;
      }
      const device = mapRowToDevice(data);
      cachedDevices = cachedDevices.map(d => (d.id === id ? device : d));
      return device;
    },

    async patchDevice(id: string, patch: DevicePatch): Promise<Device> {
      const current = cachedDevices.find(d => d.id === id) ?? (await this.getDevice(id));

      // Name and room are plain row updates; everything else is a command for the unit.
      const { name, roomId, roomName, ...control } = patch;
      if (name !== undefined || roomId !== undefined || roomName !== undefined) {
        const { error } = await supabase
          .from('devices')
          .update({ name: name ?? current.name, room_id: roomId ?? current.roomId, room_name: roomName ?? current.roomName })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      let updated: Device = { ...current, ...patch };
      if (Object.keys(control).length) {
        const { data: command, error } = await supabase
          .from('device_commands')
          .insert({ device_id: id, patch: control })
          .select('id')
          .single();
        if (error || !command) throw new CommandError(error?.message ?? 'Could not send the command.');
        logActivity(current, control);

        if (await bridgeOnline()) {
          const result = await waitForCommand(command.id);
          if (result.status === 'failed' || result.status === 'expired') {
            logger.logError('DEVICE_OFFLINE', result.error ?? 'Command failed', current.brand, current.ipAddress);
            throw new CommandError(result.error ?? 'The AC did not accept the command.');
          }
        } else {
          updated = await runWithoutBridge(current, command.id, control);
        }
      }
      cachedDevices = cachedDevices.map(d => (d.id === id ? updated : d));
      return updated;
    },

    async removeDevice(id: string): Promise<void> {
      cachedDevices = cachedDevices.filter(d => d.id !== id);
      const { error } = await supabase.from('devices').delete().eq('id', id);
      if (error) throw new Error(error.message);
      logger.logActivity('DEVICE_REMOVED', id);
    },
  };
}

function logActivity(device: Device, patch: DevicePatch) {
  if (patch.isOn !== undefined) logger.logActivity('AC_POWER_TOGGLED', device.name, { isOn: patch.isOn });
  if (patch.targetTemp !== undefined) logger.logActivity('TEMP_CHANGED', device.name, { targetTemp: patch.targetTemp });
  if (patch.mode !== undefined) logger.logActivity('MODE_CHANGED', device.name, { mode: patch.mode });
  if (patch.fanSpeed !== undefined) logger.logActivity('FAN_SPEED_CHANGED', device.name, { fanSpeed: patch.fanSpeed });
}

export type NewDevice = {
  name: string;
  vendor: string;
  brand: Brand;
  model?: string;
  roomName: string;
  ipAddress?: string;
  macAddress?: string;
  /** Tuya cloud device id, when known. */
  cloudId?: string;
  /** Brand-specific secrets (Tuya device_id/local_key, Haier device_id/local_key). */
  secrets?: Record<string, string>;
};

export async function addDeviceToSupabase(params: NewDevice): Promise<Device> {
  const id = `device-${Date.now()}`;
  const mac = (params.macAddress ?? '').toLowerCase().replace(/[^0-9a-f]/g, '');
  const { data, error } = await supabase
    .from('devices')
    .insert({
      id,
      name: params.name,
      vendor: params.vendor,
      brand: params.brand,
      model: params.model || `${params.vendor} Wi-Fi AC`,
      room_name: params.roomName || 'Living Room',
      ip_address: params.ipAddress?.trim() || null,
      mac_address: mac.length === 12 ? mac : null,
      cloud_id: params.cloudId?.trim() || null,
      status: 'offline',
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || 'Could not add device');

  const secrets = Object.fromEntries(Object.entries(params.secrets ?? {}).filter(([, v]) => v && v.trim()));
  if (Object.keys(secrets).length) await saveSecrets(id, secrets);
  logger.logActivity('DEVICE_ADDED', params.name, { brand: params.brand, vendor: params.vendor });
  return mapRowToDevice(data);
}

export type DiscoveredDevice = {
  id: number;
  brand: Brand;
  ipAddress: string;
  macAddress: string;
  name: string | null;
  model: string | null;
  needsKey: boolean;
  details: Record<string, any>;
  seenAt: string;
};

export async function fetchDiscovered(): Promise<DiscoveredDevice[]> {
  const { data, error } = await supabase.from('discovered_devices').select('*').order('seen_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    id: r.id,
    brand: r.brand,
    ipAddress: r.ip_address,
    macAddress: r.mac_address,
    name: r.name,
    model: r.model,
    needsKey: r.needs_key,
    details: r.details ?? {},
    seenAt: r.seen_at,
  }));
}

/** Calls `onChange` whenever a device row or a command changes; returns the unsubscribe function. */
export function subscribeToDeviceChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel(`app-devices-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bridges' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'discovered_devices' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
