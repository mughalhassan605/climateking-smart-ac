// node --experimental-strip-types --test supabase/functions/tuya-cloud/tuya.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commandsFor, rowFromStatus, sign, TuyaClient } from './tuya.ts';

// Expected values computed with tinytuya's Cloud._tuyaplatform signing code.
test('signature matches tinytuya', async () => {
  assert.equal(
    await sign({ clientId: 'abc123', secret: 's3cr3t', t: '1700000000000', method: 'GET', path: '/v1.0/token?grant_type=1' }),
    'FE0035154634C25E59D44C315441C3FB3987DE2EAC9B22D33D9B4616AF4C9FFC',
  );
  assert.equal(
    await sign({
      clientId: 'abc123', secret: 's3cr3t', accessToken: 'tok', t: '1700000000001', method: 'POST',
      path: '/v1.0/iot-03/devices/dev1/commands', body: '{"commands":[{"code":"switch","value":true}]}',
    }),
    '2318853E1978AE869A748907B443FAF20A1703B5EDED2148398B7B7C4711D9DC',
  );
});

const fns = [
  { code: 'mode', type: 'Enum', values: '{"range":["cool","heat","dry","fan","auto"]}' },
  { code: 'temp_set', type: 'Integer', values: '{"unit":"℃","min":160,"max":300,"scale":1,"step":5}' },
  { code: 'windspeed', type: 'Enum', values: '{"range":["1","2","3","4","5","auto"]}' },
];

test('commands follow the unit spec', () => {
  assert.deepEqual(commandsFor({ isOn: true, mode: 'cool', targetTemp: 23.5, fanSpeed: 'medium' }, fns), [
    { code: 'switch', value: true },
    { code: 'mode', value: 'cool' },
    { code: 'temp_set', value: 235 },
    { code: 'windspeed', value: '3' },
  ]);
});

test('standard codes without a spec', () => {
  assert.deepEqual(commandsFor({ mode: 'dry', targetTemp: 24, fanSpeed: 'high' }), [
    { code: 'mode', value: 'wet' },
    { code: 'temp_set', value: 24 },
    { code: 'fan_speed_enum', value: 'high' },
  ]);
});

test('status row', () => {
  assert.deepEqual(
    rowFromStatus([{ code: 'switch', value: false }, { code: 'mode', value: 'hot' }, { code: 'temp_set', value: 260 }], fns),
    { is_on: false, mode: 'heat', target_temp: 26 },
  );
});

test('client fetches a token, then sends signed commands', async () => {
  const calls: { url: string; headers: Record<string, string>; body?: string }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: init.body as string | undefined });
    const result = url.includes('/token') ? { access_token: 'tok' } : true;
    return new Response(JSON.stringify({ success: true, result }));
  }) as typeof fetch;
  const client = new TuyaClient('in', 'abc123', 's3cr3t', fake);
  assert.equal(await client.send('dev1', [{ code: 'switch', value: true }]), true);
  assert.equal(calls[0].url, 'https://openapi.tuyain.com/v1.0/token?grant_type=1');
  assert.equal(calls[1].headers.access_token, 'tok');
  assert.equal(calls[1].body, '{"commands":[{"code":"switch","value":true}]}');
});
