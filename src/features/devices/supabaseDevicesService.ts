import { supabase } from '../../config/supabase';
import { GreeControl } from '../gree/greeControl';
import { airflowParams, fanSpeedParams, modeParams, powerParams, targetTempParams } from '../gree/protocolMap';
import { tuyaControl } from '../tuya/tuyaControl';
import { logger } from '../../lib/logger';
import { deviceFixtures, DevicePatch, DevicesService } from './mockDevices';
import { DEFAULT_AIRFLOW, Device, Brand } from './types';

// Converts a database record into the app's internal Device model
function mapRowToDevice(row: any): Device {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id || 'room-living',
    roomName: row.room_name || 'Living Room',
    model: row.model || 'Wi-Fi AC',
    brand: (row.brand as Brand) || 'gree',
    vendor: row.vendor || 'Climate King',
    status: (row.status as 'online' | 'offline') || 'online',
    isOn: Boolean(row.is_on),
    mode: row.mode || 'cool',
    targetTemp: Number(row.target_temp) || 24,
    currentTemp: Number(row.current_temp) || 26,
    humidity: Number(row.humidity) || 50,
    fanSpeed: row.fan_speed || 'auto',
    airflow: row.airflow || DEFAULT_AIRFLOW,
    features: row.features || ['eco', 'sleep', 'turbo', 'swing'],
  };
}

export function createSupabaseDevicesService(): DevicesService {
  let cachedDevices: Device[] = [];

  return {
    async getDevices(): Promise<Device[]> {
      try {
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('Supabase fetch failed, using cache:', error);
          return cachedDevices;
        }

        cachedDevices = (data || []).map(mapRowToDevice);
        return cachedDevices;
      } catch (err) {
        console.warn('Supabase fetch failed, using cache:', err);
        return cachedDevices;
      }
    },

    async getDevice(id: string): Promise<Device> {
      try {
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          const fallback = cachedDevices.find(d => d.id === id);
          if (!fallback) throw new Error('Device not found');
          return fallback;
        }

        const device = mapRowToDevice(data);
        cachedDevices = cachedDevices.map(d => (d.id === id ? device : d));
        return device;
      } catch (err) {
        const fallback = cachedDevices.find(d => d.id === id);
        if (fallback) return fallback;
        throw err;
      }
    },

    async patchDevice(id: string, patch: DevicePatch): Promise<Device> {
      // 1. Optimistically update local cache
      const current = cachedDevices.find(d => d.id === id) || ({} as Device);
      const updated: Device = { ...current, ...patch };
      cachedDevices = cachedDevices.map(d => (d.id === id ? updated : d));

      // 2. Prepare payload for Supabase
      const dbPayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (patch.isOn !== undefined) dbPayload.is_on = patch.isOn;
      if (patch.mode !== undefined) dbPayload.mode = patch.mode;
      if (patch.targetTemp !== undefined) dbPayload.target_temp = patch.targetTemp;
      if (patch.fanSpeed !== undefined) dbPayload.fan_speed = patch.fanSpeed;
      if (patch.airflow !== undefined) dbPayload.airflow = patch.airflow;
      if (patch.name !== undefined) dbPayload.name = patch.name;
      if (patch.roomId !== undefined) dbPayload.room_id = patch.roomId;
      if (patch.roomName !== undefined) dbPayload.room_name = patch.roomName;

      // 3. Update Supabase
      try {
        await supabase.from('devices').update(dbPayload).eq('id', id);

        // Telemetry logging for user actions
        if (patch.isOn !== undefined) {
          logger.logActivity('AC_POWER_TOGGLED', current.name, { isOn: patch.isOn, targetTemp: current.targetTemp });
        }
        if (patch.targetTemp !== undefined) {
          logger.logActivity('TEMP_CHANGED', current.name, { targetTemp: patch.targetTemp });
        }
        if (patch.mode !== undefined) {
          logger.logActivity('MODE_CHANGED', current.name, { mode: patch.mode });
        }
        if (patch.fanSpeed !== undefined) {
          logger.logActivity('FAN_SPEED_CHANGED', current.name, { fanSpeed: patch.fanSpeed });
        }
      } catch (err: any) {
        console.warn('Failed to sync patch to Supabase:', err);
        logger.logError('NETWORK_UNREACHABLE', err?.message || 'Sync failed', current.brand);
      }

      // 4. Try hardware dispatch if local LAN parameters exist
      try {
        if (current.brand === 'gree') {
          let greeParams: Record<string, number> = {};
          if (patch.isOn !== undefined) greeParams = { ...greeParams, ...powerParams(patch.isOn) };
          if (patch.mode) greeParams = { ...greeParams, ...modeParams(patch.mode) };
          if (patch.targetTemp !== undefined) greeParams = { ...greeParams, ...targetTempParams(patch.targetTemp) };
          if (patch.fanSpeed) greeParams = { ...greeParams, ...fanSpeedParams(patch.fanSpeed) };
          if (patch.airflow) {
            greeParams = {
              ...greeParams,
              ...airflowParams(patch.airflow.vertical, 'swingVertical'),
              ...airflowParams(patch.airflow.horizontal, 'swingHorizontal'),
            };
          }
          // If we have an IP and key registered for this unit in Supabase
          // GreeControl.sendCommand({ id, mac, ip, key, protocol }, greeParams);
        } else if (current.brand === 'tuya') {
          // Tuya dispatch logic
          tuyaControl.command({ tuya: undefined }, patch).catch(() => {});
        } else if (current.brand === 'haier') {
          // Haier dispatch logic (Haier SmartAir / hOn)
          console.log('Haier dispatch for device:', current.id, patch);
        }
      } catch (hardwareErr) {
        // Hardware failure does not block the UI
        console.warn('Local LAN dispatch failed:', hardwareErr);
      }

      return updated;
    },

    async removeDevice(id: string): Promise<void> {
      cachedDevices = cachedDevices.filter(d => d.id !== id);
      try {
        await supabase.from('devices').delete().eq('id', id);
      } catch (err) {
        console.warn('Failed to delete device from Supabase:', err);
      }
    },
  };
}

export async function addDeviceToSupabase(params: {
  id?: string;
  name: string;
  vendor: string;
  brand: Brand;
  model: string;
  roomName: string;
  ipAddress?: string;
  macAddress?: string;
  localKey?: string;
}): Promise<Device> {
  const deviceId = params.id || `device-${Date.now()}`;
  const row = {
    id: deviceId,
    name: params.name,
    vendor: params.vendor,
    brand: params.brand,
    model: params.model || `${params.vendor} Smart AC`,
    room_name: params.roomName || 'Living Room',
    ip_address: params.ipAddress || '',
    mac_address: params.macAddress || '',
    local_key: params.localKey || '',
    is_on: false,
    mode: 'cool',
    target_temp: 24,
    current_temp: 26,
    humidity: 50,
    fan_speed: 'auto',
    status: 'online',
  };

  const { data, error } = await supabase.from('devices').upsert(row).select().single();
  if (error || !data) {
    throw new Error(error?.message || 'Could not add device');
  }

  return mapRowToDevice(data);
}
