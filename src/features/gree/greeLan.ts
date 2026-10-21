import { DevicePatch } from '../devices/mockDevices';
import { Device } from '../devices/types';
import { GreeControl, GreeCredential } from './greeControl';
import { GreeProtocol } from './crypto';
import {
  airflowFromGree,
  airflowParams,
  clampAmbient,
  clampTemp,
  fanFromGree,
  fanSpeedParams,
  modeFromGree,
  modeParams,
  powerParams,
  targetTempParams,
} from './protocolMap';

// Direct control of a Gree / Climate King unit from the phone, used only when no Home Bridge is
// online and the phone is on the same Wi-Fi. The bind key comes from device_secrets, where the
// bridge (or an earlier bind from this phone) stored it.

export type GreeSecrets = { key?: string; cipher?: GreeProtocol };

export type LanResult<T> = { value: T; ip: string; secrets: GreeSecrets };

function credential(device: Device, ip: string, secrets: GreeSecrets): GreeCredential | null {
  const mac = device.macAddress;
  if (!mac || !ip || !secrets.key) return null;
  return { id: device.id, mac, ip, key: secrets.key, protocol: secrets.cipher ?? 'v1' };
}

/**
 * Run `op` against the unit; on silence, re-bind (the key may have changed after a module reset)
 * and then search the LAN by MAC in case the router gave it a new address.
 */
async function withRecovery<T>(
  device: Device,
  secrets: GreeSecrets,
  op: (cred: GreeCredential) => Promise<T | null>,
): Promise<LanResult<T> | null> {
  const mac = device.macAddress?.toLowerCase();
  if (!mac) return null;
  const candidates = [device.ipAddress ?? ''];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const ip of candidates.filter(Boolean)) {
      const known = credential(device, ip, secrets);
      if (known) {
        const value = await op(known);
        if (value !== null) return { value, ip, secrets };
      }
      const bound = await GreeControl.bindDevice(ip, mac);
      if (bound) {
        const fresh: GreeSecrets = { key: bound.key, cipher: bound.protocol };
        const value = await op(bound);
        if (value !== null) return { value, ip, secrets: fresh };
      }
    }
    if (attempt === 0) {
      const found = await GreeControl.scanForDevices();
      const moved = found.find(f => f.mac.toLowerCase() === mac);
      if (!moved || candidates.includes(moved.ip)) return null;
      candidates.splice(0, candidates.length, moved.ip);
    }
  }
  return null;
}

export function applyGreeStatus(device: Device, dat: Record<string, number>): Device {
  return {
    ...device,
    status: 'online',
    isOn: dat.Pow === 1,
    mode: modeFromGree(dat.Mod),
    targetTemp: clampTemp(dat.SetTem ?? device.targetTemp),
    currentTemp: dat.TemSen !== undefined ? clampAmbient(dat.TemSen > 60 ? dat.TemSen - 40 : dat.TemSen) : device.currentTemp,
    fanSpeed: fanFromGree(dat),
    airflow: airflowFromGree(dat),
  };
}

export function patchToGreeParams(patch: DevicePatch): Record<string, number> {
  let params: Record<string, number> = {};
  if (patch.isOn !== undefined) params = { ...params, ...powerParams(patch.isOn) };
  if (patch.mode) params = { ...params, ...modeParams(patch.mode) };
  if (patch.targetTemp !== undefined) params = { ...params, ...targetTempParams(patch.targetTemp) };
  if (patch.fanSpeed) params = { ...params, ...fanSpeedParams(patch.fanSpeed) };
  if (patch.airflow) {
    params = {
      ...params,
      ...airflowParams(patch.airflow.vertical, 'swingVertical'),
      ...airflowParams(patch.airflow.horizontal, 'swingHorizontal'),
    };
  }
  return params;
}

export function readGreeOnLan(device: Device, secrets: GreeSecrets): Promise<LanResult<Device> | null> {
  return withRecovery(device, secrets, async cred => {
    const dat = await GreeControl.readStatus(cred);
    return dat ? applyGreeStatus(device, dat) : null;
  });
}

export function sendGreeOnLan(device: Device, secrets: GreeSecrets, patch: DevicePatch): Promise<LanResult<Device> | null> {
  const params = patchToGreeParams(patch);
  return withRecovery(device, secrets, async cred => {
    // The reply only echoes the changed columns, so the result is the patch on top of the old state.
    const echoed = await GreeControl.sendCommand(cred, params);
    return echoed ? { ...device, ...patch, status: 'online' as const } : null;
  });
}
