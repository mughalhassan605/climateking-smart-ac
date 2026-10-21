// Tuya OpenAPI signing and the AC command mapping, kept free of Deno APIs so it can be tested
// under Node as well. Mirrors bridge/climateking_bridge/drivers/tuya.py (to_cloud_commands).

export const TUYA_HOSTS: Record<string, string> = {
  cn: 'openapi.tuyacn.com',
  us: 'openapi.tuyaus.com',
  'us-e': 'openapi-ueaz.tuyaus.com',
  eu: 'openapi.tuyaeu.com',
  'eu-w': 'openapi-weaz.tuyaeu.com',
  in: 'openapi.tuyain.com',
  sg: 'openapi-sg.iotbing.com',
};

const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

export async function hmacSha256Upper(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(message))).toUpperCase();
}

/** Tuya's request signature (the algorithm in use since 2021-06-30). `path` includes the query. */
export async function sign(params: {
  clientId: string;
  secret: string;
  accessToken?: string;
  t: string;
  method: string;
  path: string;
  body?: string;
}): Promise<string> {
  const stringToSign = [params.method, await sha256Hex(params.body ?? ''), '', params.path].join('\n');
  return hmacSha256Upper(params.secret, params.clientId + (params.accessToken ?? '') + params.t + stringToSign);
}

export class TuyaError extends Error {}

export class TuyaClient {
  private token: string | null = null;
  private readonly host: string;
  private readonly clientId: string;
  private readonly secret: string;
  private readonly fetchImpl: typeof fetch;

  constructor(region: string, clientId: string, secret: string, fetchImpl: typeof fetch = fetch) {
    const host = TUYA_HOSTS[region.toLowerCase()];
    if (!host) throw new TuyaError(`Unknown Tuya region "${region}"`);
    this.host = host;
    this.clientId = clientId;
    this.secret = secret;
    this.fetchImpl = fetchImpl;
  }

  private async call<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const t = Date.now().toString();
    const payload = body === undefined ? '' : JSON.stringify(body);
    if (auth && !this.token) this.token = await this.fetchToken();
    const headers: Record<string, string> = {
      client_id: this.clientId,
      t,
      sign_method: 'HMAC-SHA256',
      sign: await sign({
        clientId: this.clientId,
        secret: this.secret,
        accessToken: auth ? this.token ?? '' : '',
        t,
        method,
        path,
        body: payload,
      }),
      'Content-Type': 'application/json',
    };
    if (auth && this.token) headers.access_token = this.token;
    const res = await this.fetchImpl(`https://${this.host}${path}`, {
      method,
      headers,
      body: payload || undefined,
    });
    const json = (await res.json()) as { success?: boolean; result?: T; msg?: string; code?: number };
    if (!json.success) throw new TuyaError(json.msg || `Tuya error ${json.code ?? res.status}`);
    return json.result as T;
  }

  private async fetchToken(): Promise<string> {
    const result = await this.call<{ access_token: string }>('GET', '/v1.0/token?grant_type=1', undefined, false);
    return result.access_token;
  }

  functions(deviceId: string) {
    return this.call<{ functions: TuyaFunction[] }>('GET', `/v1.0/iot-03/devices/${deviceId}/functions`);
  }

  status(deviceId: string) {
    return this.call<{ code: string; value: unknown }[]>('GET', `/v1.0/iot-03/devices/${deviceId}/status`);
  }

  send(deviceId: string, commands: { code: string; value: unknown }[]) {
    return this.call<boolean>('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, { commands });
  }
}

export type TuyaFunction = { code: string; type: string; values: string };

export type Patch = {
  isOn?: boolean;
  mode?: 'cool' | 'heat' | 'dry' | 'fan' | 'auto';
  targetTemp?: number;
  fanSpeed?: string;
};

const MODE_WORDS: Record<string, string[]> = {
  cool: ['cold', 'cool', 'cooling'],
  heat: ['hot', 'heat', 'heating'],
  dry: ['wet', 'dry', 'dehumidification'],
  fan: ['wind', 'fan', 'fan_only'],
  auto: ['auto', 'smart'],
};
const FAN_WORDS: Record<string, string[]> = {
  auto: ['auto'],
  quiet: ['mute', 'low', 'sleep'],
  low: ['low', '1'],
  mediumLow: ['low', '2'],
  medium: ['middle', 'mid', 'medium', '3'],
  mediumHigh: ['high', '4'],
  high: ['high', 'strong', '5'],
  turbo: ['strong', 'turbo', 'high', '5'],
};
const FAN_CODES = ['fan_speed_enum', 'windspeed', 'wind_speed', 'fan_speed'];

function spec(fns: TuyaFunction[], code: string): Record<string, unknown> | null {
  const fn = fns.find(f => f.code === code);
  if (!fn) return null;
  try {
    return JSON.parse(fn.values || '{}');
  } catch {
    return {};
  }
}

function pick(words: string[], range: unknown): string {
  const options = Array.isArray(range) ? range.map(String) : [];
  return words.find(w => options.includes(w)) ?? words[0];
}

/**
 * Commands for one app patch, in the vocabulary this unit's function spec declares (its own mode
 * words, its temperature scale, whichever fan code it has). Falls back to Tuya's standard air
 * conditioner codes when the spec is unavailable.
 */
export function commandsFor(patch: Patch, fns: TuyaFunction[] = []): { code: string; value: unknown }[] {
  const out: { code: string; value: unknown }[] = [];
  if (patch.isOn !== undefined) out.push({ code: 'switch', value: patch.isOn });
  if (patch.mode) {
    const range = spec(fns, 'mode')?.range;
    out.push({ code: 'mode', value: pick(MODE_WORDS[patch.mode] ?? [patch.mode], range) });
  }
  if (patch.targetTemp !== undefined) {
    const s = spec(fns, 'temp_set');
    const scale = typeof s?.scale === 'number' ? s.scale : 0;
    let value = Math.round(patch.targetTemp * 10 ** scale);
    if (typeof s?.min === 'number') value = Math.max(s.min, value);
    if (typeof s?.max === 'number') value = Math.min(s.max, value);
    out.push({ code: 'temp_set', value });
  }
  if (patch.fanSpeed) {
    const code = FAN_CODES.find(c => fns.some(f => f.code === c)) ?? 'fan_speed_enum';
    out.push({ code, value: pick(FAN_WORDS[patch.fanSpeed] ?? [patch.fanSpeed], spec(fns, code)?.range) });
  }
  return out;
}

/** Columns for the devices row from a Tuya status list. */
export function rowFromStatus(status: { code: string; value: unknown }[], fns: TuyaFunction[] = []) {
  const by = new Map(status.map(s => [s.code, s.value]));
  const scale = Number(spec(fns, 'temp_set')?.scale ?? 0);
  const row: Record<string, unknown> = {};
  if (typeof by.get('switch') === 'boolean') row.is_on = by.get('switch');
  const mode = by.get('mode');
  if (typeof mode === 'string') {
    const found = Object.entries(MODE_WORDS).find(([, words]) => words.includes(mode));
    if (found) row.mode = found[0];
  }
  const target = by.get('temp_set');
  if (typeof target === 'number') row.target_temp = target / 10 ** scale;
  const current = by.get('temp_current');
  if (typeof current === 'number') row.current_temp = current / 10 ** scale;
  return row;
}
