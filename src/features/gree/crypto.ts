import { Buffer } from '@craftzdog/react-native-buffer';
import QuickCrypto from 'react-native-quick-crypto';

// Gree LAN encryption, same constants as the original module 627.
// v1: AES-128-ECB with PKCS7; v2: AES-128-GCM with a fixed IV and AAD, tag sent alongside.

export type GreeProtocol = 'v1' | 'v2';

export const GENERIC_KEY_V1 = 'a3K8Bx%2r8Y7#xDh';
export const GENERIC_KEY_V2 = '{yxAHAY_Lm6pbC/<';
const GCM_IV = Buffer.from('5440784449675a516c5e6313', 'hex');
const GCM_AAD = Buffer.from('qualcomm-test', 'utf8');
// ECB takes no IV; a zero-length buffer is the typed equivalent of null.
const NO_IV = Buffer.alloc(0);

export const genericKey = (protocol: GreeProtocol) => (protocol === 'v2' ? GENERIC_KEY_V2 : GENERIC_KEY_V1);

export function encryptPack(plain: string, key: string, protocol: GreeProtocol): { pack: string; tag?: string } {
  const data = Buffer.from(plain, 'utf8');
  const k = Buffer.from(key, 'utf8');
  if (protocol === 'v2') {
    const cipher = QuickCrypto.createCipheriv('aes-128-gcm', k, GCM_IV);
    cipher.setAAD(GCM_AAD);
    const enc = Buffer.concat([cipher.update(data), cipher.final()]);
    return { pack: enc.toString('base64'), tag: Buffer.from(cipher.getAuthTag()).toString('base64') };
  }
  const cipher = QuickCrypto.createCipheriv('aes-128-ecb', k, NO_IV);
  cipher.setAutoPadding(true);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  return { pack: enc.toString('base64') };
}

export function decryptPack(pack: string, key: string, protocol: GreeProtocol, tag?: string): string {
  const data = Buffer.from(pack, 'base64');
  const k = Buffer.from(key, 'utf8');
  if (protocol === 'v2') {
    if (!tag) throw new Error('Gree v2 pack arrived without an auth tag.');
    const decipher = QuickCrypto.createDecipheriv('aes-128-gcm', k, GCM_IV);
    decipher.setAAD(GCM_AAD);
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
  const decipher = QuickCrypto.createDecipheriv('aes-128-ecb', k, NO_IV);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// A scan reply tells us nothing about the protocol up front, so try the likely one first.
export function detectProtocol(pack: string, tag?: string): { protocol: GreeProtocol; payload: any } | null {
  const order: GreeProtocol[] = tag ? ['v2', 'v1'] : ['v1', 'v2'];
  for (const protocol of order) {
    try {
      const payload = JSON.parse(decryptPack(pack, genericKey(protocol), protocol, tag));
      return { protocol, payload };
    } catch {
      // try the next protocol
    }
  }
  return null;
}
