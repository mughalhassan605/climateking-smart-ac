import { encryptPack, genericKey, GreeProtocol } from './crypto';

// Envelopes identical to the original module 748.

export const SCAN_MESSAGE = { t: 'scan' } as const;

type Envelope = { t: 'pack'; i: 0 | 1; uid: 0; cid: 'app'; tcid: string; pack: string; tag?: string };

function envelope(mac: string, i: 0 | 1, sealed: { pack: string; tag?: string }): Envelope {
  const env: Envelope = { t: 'pack', i, uid: 0, cid: 'app', tcid: mac, pack: sealed.pack };
  if (sealed.tag) env.tag = sealed.tag;
  return env;
}

export function bindMessage(mac: string, protocol: GreeProtocol): Envelope {
  const inner = JSON.stringify({ mac, t: 'bind', uid: 0 });
  return envelope(mac, 1, encryptPack(inner, genericKey(protocol), protocol));
}

export function statusMessage(mac: string, key: string, protocol: GreeProtocol, cols: readonly string[]): Envelope {
  const inner = JSON.stringify({ cols, mac, t: 'status' });
  return envelope(mac, 0, encryptPack(inner, key, protocol));
}

export function commandMessage(mac: string, key: string, protocol: GreeProtocol, params: Record<string, number>): Envelope {
  const inner = JSON.stringify({ opt: Object.keys(params), p: Object.values(params), t: 'cmd' });
  return envelope(mac, 0, encryptPack(inner, key, protocol));
}

export type ParsedEnvelope = { t: string; pack?: string; tag?: string; cid?: string; i?: number };

export function parseEnvelope(raw: string): ParsedEnvelope | null {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function zipParams(cols: string[], dat: unknown[]): Record<string, number> {
  const out: Record<string, number> = {};
  cols.forEach((c, i) => {
    const v = dat[i];
    if (typeof v === 'number') out[c] = v;
  });
  return out;
}
