import { decryptPack, detectProtocol, genericKey, GreeProtocol } from './crypto';
import { bindMessage, commandMessage, parseEnvelope, SCAN_MESSAGE, statusMessage, zipParams } from './messages';
import { GREE_PORT, lanExchange } from './transport';
import { STATUS_COLS } from './protocolMap';

// One bound Gree unit's local credentials (persisted; original greeCredentialStore, module 780).
export type GreeCredential = {
  id: string;
  mac: string;
  ip: string;
  key: string;
  protocol: GreeProtocol;
};

const SCAN_TIMEOUT = 3000;
const OP_TIMEOUT = 2000;

export type ScanResult = { mac: string; ip: string };

// Discover units on the LAN. Broadcast {"t":"scan"}; each unit replies with an encrypted pack
// carrying its mac. Retransmits inside the window so a single dropped packet isn't a miss.
export async function scanForDevices(): Promise<ScanResult[]> {
  const results = new Map<string, ScanResult>();
  await lanExchange({
    message: SCAN_MESSAGE,
    address: '255.255.255.255',
    broadcast: true,
    timeoutMs: SCAN_TIMEOUT,
    attempts: 3,
    onReply: (raw, from) => {
      const env = parseEnvelope(raw);
      if (!env?.pack) return false;
      const detected = detectProtocol(env.pack, env.tag);
      const mac = detected?.payload?.mac ?? detected?.payload?.cid;
      if (mac) results.set(from.address, { mac, ip: from.address });
      return false; // keep listening for more units
    },
  });
  return [...results.values()];
}

// Bind to a unit to obtain its per-device key (needed for status/command).
export async function bindDevice(ip: string, mac: string): Promise<GreeCredential | null> {
  for (const protocol of ['v2', 'v1'] as GreeProtocol[]) {
    let key: string | null = null;
    await lanExchange({
      message: bindMessage(mac, protocol),
      address: ip,
      timeoutMs: OP_TIMEOUT,
      attempts: 3,
      onReply: raw => {
        const env = parseEnvelope(raw);
        if (!env?.pack) return false;
        try {
          const text = decryptPack(env.pack, genericKey(protocol), protocol, env.tag);
          const payload = JSON.parse(text);
          if (payload.key) {
            key = payload.key;
            return true;
          }
        } catch {}
        return false;
      },
    });
    if (key) return { id: mac, mac, ip, key, protocol };
  }
  return null;
}

async function exchangePack(cred: GreeCredential, message: object): Promise<Record<string, number> | null> {
  let out: Record<string, number> | null = null;
  await lanExchange({
    message,
    address: cred.ip,
    timeoutMs: OP_TIMEOUT,
    attempts: 3,
    onReply: raw => {
      const env = parseEnvelope(raw);
      if (!env?.pack) return false;
      try {
        const text = decryptPack(env.pack, cred.key, cred.protocol, env.tag);
        const payload = JSON.parse(text);
        if (Array.isArray(payload.cols) && Array.isArray(payload.dat)) {
          out = zipParams(payload.cols, payload.dat);
          return true;
        }
        if (Array.isArray(payload.opt) && Array.isArray(payload.val)) {
          out = zipParams(payload.opt, payload.val);
          return true;
        }
      } catch {}
      return false;
    },
  });
  return out;
}

export function readStatus(cred: GreeCredential) {
  return exchangePack(cred, statusMessage(cred.mac, cred.key, cred.protocol, STATUS_COLS));
}

export function sendCommand(cred: GreeCredential, params: Record<string, number>) {
  return exchangePack(cred, commandMessage(cred.mac, cred.key, cred.protocol, params));
}

export const GreeControl = { scanForDevices, bindDevice, readStatus, sendCommand, GREE_PORT };
