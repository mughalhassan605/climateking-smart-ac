import { Buffer } from '@craftzdog/react-native-buffer';
import QuickCrypto from 'react-native-quick-crypto';
import dgram from 'react-native-udp';
import { GreeControl } from '../gree/greeControl';
import { Brand } from './types';

// Find ACs of every supported brand from the phone itself, the same probes the Home Bridge runs
// (bridge/climateking_bridge/discovery.py). Haier is left to the bridge: its discovery needs the
// uSS stack, which the app does not carry.

export type PhoneFound = {
  brand: Brand;
  ip: string;
  /** MAC for Gree / BroadLink / TCL; Tuya announces no MAC, so this is its device id. */
  mac: string;
  name?: string;
  deviceId?: string;
};

type UdpSocket = ReturnType<typeof dgram.createSocket> & {
  on(event: 'message', fn: (msg: Buffer, rinfo: { address: string; port: number }) => void): void;
  on(event: 'error', fn: (err: Error) => void): void;
};

const AUX_DEVTYPE = 0x4e2a; // Kenwood and other AC Freedom units
const TCL_DEVTYPES = [0x507c, 0x507a];

// md5("yGAdlopoPVldABfn"), the fixed key Tuya units encrypt their LAN announcements with.
const TUYA_UDP_KEY = Buffer.from('6c1ec8e2bb9bb59ab50b0daf649b410a', 'hex');

function openSocket(port: number, onMessage: (msg: Buffer, from: string) => void): Promise<UdpSocket | null> {
  return new Promise(resolve => {
    const socket = dgram.createSocket({ type: 'udp4', reusePort: true }) as UdpSocket;
    socket.on('message', (msg, rinfo) => {
      try {
        onMessage(Buffer.from(msg), rinfo.address);
      } catch {
        // foreign or malformed packet
      }
    });
    socket.on('error', () => resolve(null));
    try {
      socket.bind(port, () => {
        try {
          socket.setBroadcast(true);
        } catch {
          // some ROMs refuse; listening still works
        }
        resolve(socket);
      });
    } catch {
      resolve(null);
    }
  });
}

const closeAll = (sockets: (UdpSocket | null)[]) =>
  sockets.forEach(s => {
    try {
      s?.close();
    } catch {
      // already closed
    }
  });

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function broadlinkHello(): Buffer {
  const packet = Buffer.alloc(0x30);
  const now = new Date();
  packet.writeInt32LE(-Math.round(now.getTimezoneOffset() / 60), 0x08);
  packet.writeUInt16LE(now.getFullYear(), 0x0c);
  packet[0x0e] = now.getMinutes();
  packet[0x0f] = now.getHours();
  packet[0x10] = now.getFullYear() % 100;
  packet[0x11] = now.getDay() || 7;
  packet[0x12] = now.getDate();
  packet[0x13] = now.getMonth() + 1;
  packet[0x26] = 6;
  let checksum = 0xbeaf;
  for (const byte of packet) checksum += byte;
  packet.writeUInt16LE(checksum % 0x10000, 0x20);
  return packet;
}

/** Kenwood (AC Freedom) and TCL Intelligent AC units answer the BroadLink hello on UDP 80. */
export async function scanBroadlink(seconds = 4): Promise<PhoneFound[]> {
  const found = new Map<string, PhoneFound>();
  const socket = await openSocket(0, (msg, from) => {
    if (msg.length < 0x40) return;
    const devtype = msg.readUInt16LE(0x34);
    const brand: Brand | null = devtype === AUX_DEVTYPE ? 'broadlink' : TCL_DEVTYPES.includes(devtype) ? 'tcl' : null;
    if (!brand) return;
    const mac = Buffer.from(msg.subarray(0x3a, 0x40)).reverse().toString('hex');
    const name = Buffer.from(msg.subarray(0x40)).toString('utf8').split('\u0000')[0] || undefined;
    found.set(mac, { brand, ip: from, mac, name });
  });
  if (!socket) return [];
  const hello = broadlinkHello();
  for (let i = 0; i < seconds; i += 1) {
    socket.send(hello, 0, hello.length, 80, '255.255.255.255', () => {});
    await wait(1000);
  }
  closeAll([socket]);
  return [...found.values()];
}

function tuyaPayload(msg: Buffer, encrypted: boolean): any {
  // 0x000055AA frame: 16-byte header (prefix, seq, cmd, len), 4-byte return code, payload, CRC, suffix.
  if (msg.readUInt32BE(0) !== 0x000055aa) return null;
  const length = msg.readUInt32BE(12);
  const payload = Buffer.from(msg.subarray(20, 16 + length - 8));
  if (!encrypted || payload[0] === 0x7b) return JSON.parse(payload.toString('utf8'));
  const decipher = QuickCrypto.createDecipheriv('aes-128-ecb', TUYA_UDP_KEY, Buffer.alloc(0));
  decipher.setAutoPadding(true);
  return JSON.parse(Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8'));
}

/** Hyundai and other Smart Life units announce themselves every few seconds on UDP 6666 / 6667. */
export async function scanTuya(seconds = 7): Promise<PhoneFound[]> {
  const found = new Map<string, PhoneFound>();
  const listener = (encrypted: boolean) => (msg: Buffer, from: string) => {
    const info = tuyaPayload(msg, encrypted);
    const deviceId = info?.gwId || info?.devId;
    if (deviceId) found.set(deviceId, { brand: 'tuya', ip: info.ip || from, mac: deviceId, deviceId });
  };
  const sockets = await Promise.all([openSocket(6666, listener(false)), openSocket(6667, listener(true))]);
  await wait(seconds * 1000);
  closeAll(sockets);
  return [...found.values()];
}

export async function scanGree(): Promise<PhoneFound[]> {
  const units = await GreeControl.scanForDevices();
  return units.map(u => ({ brand: 'gree' as Brand, ip: u.ip, mac: u.mac.toLowerCase() }));
}

/** Every brand at once. A probe that fails (port taken, no Wi-Fi) is skipped, not fatal. */
export async function scanAllFromPhone(): Promise<PhoneFound[]> {
  const results = await Promise.allSettled([scanGree(), scanBroadlink(), scanTuya()]);
  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  const unique = new Map(all.map(f => [`${f.brand}:${f.mac}`, f]));
  return [...unique.values()];
}
