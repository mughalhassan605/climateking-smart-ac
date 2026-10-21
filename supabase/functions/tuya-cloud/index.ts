// Runs a queued command for a Smart Life / Tuya AC (Hyundai, TCL SmartLife, ...) through the Tuya
// cloud. The app calls this when the Home Bridge is offline, so those units stay controllable
// from anywhere even with the bridge down.
//
// Deploy:  supabase functions deploy tuya-cloud
// Secrets: supabase secrets set TUYA_REGION=in TUYA_API_KEY=... TUYA_API_SECRET=...
//
// The caller's own JWT is used for every database access, so row level security decides which
// commands and devices it can touch. The Tuya project's linked Smart Life account decides which
// units the Tuya credentials can reach: link the household account that owns the ACs.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { commandsFor, rowFromStatus, TuyaClient, TuyaError, type Patch } from './tuya.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });

  const region = Deno.env.get('TUYA_REGION');
  const key = Deno.env.get('TUYA_API_KEY');
  const secret = Deno.env.get('TUYA_API_SECRET');
  if (!region || !key || !secret) return reply(503, { error: 'Tuya cloud is not configured on this project.' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return reply(401, { error: 'Sign in first.' });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });

  let commandId: number;
  try {
    commandId = Number((await req.json()).commandId);
    if (!Number.isInteger(commandId)) throw new Error();
  } catch {
    return reply(400, { error: 'Body must be {"commandId": <number>}.' });
  }

  // Claim the command so the bridge (if it comes back) does not run it a second time.
  const { data: claimed } = await db
    .from('device_commands')
    .update({ status: 'running', executed_by: 'tuya-cloud' })
    .eq('id', commandId)
    .eq('status', 'pending')
    .select('id, device_id, patch')
    .maybeSingle();
  if (!claimed) return reply(409, { error: 'Command not found or already handled.' });

  const finish = (status: 'done' | 'failed', error: string | null = null) =>
    db.from('device_commands').update({ status, error, executed_at: new Date().toISOString() }).eq('id', commandId);

  const { data: device } = await db.from('devices').select('id, brand, cloud_id').eq('id', claimed.device_id).single();
  if (!device || device.brand !== 'tuya' || !device.cloud_id) {
    await finish('failed', 'This unit has no Tuya cloud id. Run `climateking-bridge tuya-sync` once.');
    return reply(422, { error: 'Not a Tuya cloud unit.' });
  }

  const tuya = new TuyaClient(region, key, secret);
  try {
    const { functions } = await tuya.functions(device.cloud_id).catch(() => ({ functions: [] }));
    const commands = commandsFor(claimed.patch as Patch, functions);
    if (commands.length) await tuya.send(device.cloud_id, commands);
    await finish('done');
    const status = await tuya.status(device.cloud_id).catch(() => null);
    if (status) {
      await db
        .from('devices')
        .update({ ...rowFromStatus(status, functions), status: 'online', last_seen: new Date().toISOString() })
        .eq('id', device.id);
    }
    return reply(200, { ok: true, commands });
  } catch (err) {
    const message = err instanceof TuyaError ? `Tuya cloud: ${err.message}` : 'Tuya cloud request failed.';
    await finish('failed', message);
    return reply(502, { error: message });
  }
});
