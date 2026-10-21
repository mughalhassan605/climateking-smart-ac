import { StorageKeys, storage } from '../../lib/storage';
import { DevicePatch, DevicesService } from '../devices/mockDevices';
import { Brand, DEFAULT_AIRFLOW, Device } from '../devices/types';
import { GreeControl, GreeCredential } from './greeControl';
import { airflowFromGree, airflowParams, fanFromGree, modeFromGree, powerParams, modeParams, fanSpeedParams, targetTempParams, clampAmbient, clampTemp } from './protocolMap';
import { tuyaControl, TuyaCredential } from '../tuya/tuyaControl';

// A unit the user has added, with whatever each protocol needs to reach it. The display fields
// (name/room/model/vendor) live here; live values come from the device each refresh.
export type RegisteredDevice = {
  id: string;
  brand: Brand;
  name: string;
  roomId: string;
  roomName: string;
  model: string;
  vendor?: string;
  gree?: GreeCredential;
  tuya?: TuyaCredential;
};

function loadRegistry(): RegisteredDevice[] {
  return storage.getObject<RegisteredDevice[]>(StorageKeys.greeCredentials) ?? [];
}
function saveRegistry(list: RegisteredDevice[]) {
  storage.setObject(StorageKeys.greeCredentials, list);
}

function baseDevice(reg: RegisteredDevice): Device {
  return {
    id: reg.id,
    name: reg.name,
    roomId: reg.roomId || 'unassigned',
    roomName: reg.roomName || 'My Home',
    model: reg.model,
    vendor: reg.vendor,
    brand: reg.brand,
    status: 'offline',
    isOn: false,
    mode: 'cool',
    targetTemp: 24,
    currentTemp: 24,
    humidity: 0,
    fanSpeed: 'auto',
    airflow: DEFAULT_AIRFLOW,
    features: [],
  };
}

function applyGreeStatus(device: Device, dat: Record<string, number>): Device {
  return {
    ...device,
    status: 'online',
    isOn: dat.Pow === 1,
    mode: modeFromGree(dat.Mod),
    targetTemp: clampTemp(dat.SetTem ?? device.targetTemp),
    currentTemp: dat.TemSen !== undefined ? clampAmbient(dat.TemSen) : device.currentTemp,
    fanSpeed: fanFromGree(dat),
    airflow: airflowFromGree(dat),
  };
}

async function readGree(reg: RegisteredDevice): Promise<Device> {
  const base = baseDevice(reg);
  if (!reg.gree) return base;
  try {
    const dat = await GreeControl.readStatus(reg.gree);
    return dat ? applyGreeStatus(base, dat) : { ...base, stale: true };
  } catch {
    return { ...base, stale: true };
  }
}

function patchToGreeParams(patch: DevicePatch): Record<string, number> {
  let params: Record<string, number> = {};
  if (patch.isOn !== undefined) params = { ...params, ...powerParams(patch.isOn) };
  if (patch.mode) params = { ...params, ...modeParams(patch.mode) };
  if (patch.targetTemp !== undefined) params = { ...params, ...targetTempParams(patch.targetTemp) };
  if (patch.fanSpeed) params = { ...params, ...fanSpeedParams(patch.fanSpeed) };
  if (patch.airflow) {
    params = { ...params, ...airflowParams(patch.airflow.vertical, 'swingVertical'), ...airflowParams(patch.airflow.horizontal, 'swingHorizontal') };
  }
  return params;
}

export function createGreeDevicesService(): DevicesService {
  let registry = loadRegistry();
  const find = (id: string) => {
    const reg = registry.find(r => r.id === id);
    if (!reg) throw new Error('Device not found.');
    return reg;
  };
  const read = (reg: RegisteredDevice) => (reg.brand === 'tuya' ? tuyaControl.read(reg, baseDevice(reg)) : readGree(reg));

  return {
    async getDevices() {
      registry = loadRegistry();
      return Promise.all(registry.map(read));
    },
    async getDevice(id) {
      registry = loadRegistry();
      return read(find(id));
    },
    async patchDevice(id, patch) {
      const reg = find(id);
      if (reg.brand === 'tuya') {
        await tuyaControl.command(reg, patch);
      } else if (reg.gree) {
        const params = patchToGreeParams(patch);
        if (Object.keys(params).length) await GreeControl.sendCommand(reg.gree, params);
      }
      // Persist display-affecting fields; live values come back on the next status read.
      if (patch.name || patch.roomId || patch.roomName) {
        registry = registry.map(r => (r.id === id ? { ...r, name: patch.name ?? r.name, roomId: patch.roomId ?? r.roomId, roomName: patch.roomName ?? r.roomName } : r));
        saveRegistry(registry);
      }
      return read(find(id));
    },
    async removeDevice(id) {
      registry = registry.filter(r => r.id !== id);
      saveRegistry(registry);
    },
  };
}

export const greeRegistry = { load: loadRegistry, save: saveRegistry };
