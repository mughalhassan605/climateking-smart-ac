import { DevicePatch } from '../devices/mockDevices';
import { Device } from '../devices/types';

// Tuya/SmartLife units (Kenwood, Hyundai, and most non-Gree Wi-Fi ACs). Local control needs the
// device's `localKey`, which Tuya only hands out through its cloud after the unit is paired to an
// account. Until that key is supplied, we surface the unit as present-but-unbound rather than
// pretending to control it. The LAN framing (protocol 3.3/3.4 on TCP 6668) is implemented once a
// key exists; see docs. This keeps the multi-brand model honest instead of silently failing.

export type TuyaCredential = {
  gwId: string;
  ip: string;
  version: '3.1' | '3.3' | '3.4';
  localKey?: string;
};

export class TuyaKeyMissingError extends Error {
  constructor() {
    super('This Kenwood/Hyundai (Tuya) unit needs its local key. Pair it in the app to fetch the key, then control works.');
    this.name = 'TuyaKeyMissingError';
  }
}

async function read(cred: { tuya?: TuyaCredential }, base: Device): Promise<Device> {
  if (!cred.tuya?.localKey) {
    // Reachable on Wi-Fi but we can't decrypt its state without the key.
    return { ...base, status: 'offline', awaitingVendor: true };
  }
  // TODO: Tuya 3.3/3.4 local status query over TCP 6668 (needs a native TCP socket module).
  return { ...base, stale: true };
}

async function command(_cred: { tuya?: TuyaCredential }, _patch: DevicePatch): Promise<void> {
  if (!_cred.tuya?.localKey) throw new TuyaKeyMissingError();
  // TODO: build and send the Tuya 3.3/3.4 control frame over TCP 6668.
  throw new TuyaKeyMissingError();
}

export const tuyaControl = { read, command };
