-- ClimateKing: per-user devices, Home Bridge command queue and heartbeat.
--
-- Safe to run on a project that already has the old `devices` / `user_activity` / `error_logs`
-- tables: every statement is idempotent and only adds columns. Rows created before this migration
-- have no owner and become invisible once row level security is on. Claim them with:
--   update public.devices set owner_id = '<your auth user id>' where owner_id is null;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------------------------
-- Devices: one row per AC. The app writes the display fields; the Home Bridge writes live state.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.devices (
  id text primary key,
  name text not null,
  vendor text not null,
  brand text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.devices
  add column if not exists owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  add column if not exists model text,
  add column if not exists room_id text,
  add column if not exists room_name text,
  add column if not exists ip_address text,
  add column if not exists mac_address text,
  add column if not exists is_on boolean default false,
  add column if not exists mode text default 'cool',
  add column if not exists target_temp numeric default 24,
  add column if not exists current_temp numeric,
  add column if not exists humidity numeric,
  add column if not exists fan_speed text default 'auto',
  add column if not exists airflow jsonb,
  add column if not exists features jsonb,
  add column if not exists status text default 'offline',
  -- Set by the Home Bridge: when it last heard from the unit, and why it could not.
  add column if not exists last_seen timestamptz,
  add column if not exists last_error text,
  -- Tuya cloud device id, used by the cloud fallback when the bridge is offline.
  add column if not exists cloud_id text;

-- `brand` is the wire protocol, `vendor` the name on the unit:
--   gree      Climate King, Gree (Gree UDP 7000)
--   broadlink Kenwood and other AC Freedom units (BroadLink/AUX UDP 80)
--   tcl       TCL Intelligent AC units (BroadLink DNA UDP 80)
--   tuya      Hyundai, TCL SmartLife and other Smart Life units (Tuya TCP 6668)
--   haier     Haier HaiSmart / U+ units (uSS TCP 56800)
alter table public.devices drop constraint if exists devices_brand_check;
alter table public.devices
  add constraint devices_brand_check check (brand in ('gree', 'broadlink', 'tcl', 'tuya', 'haier'));

create index if not exists devices_owner_idx on public.devices (owner_id);

-- ---------------------------------------------------------------------------------------------
-- Per-device secrets, one flat JSON object per device whose keys depend on the brand:
--   gree   {"key", "cipher": "v1"|"v2"}          learned by the bridge when it binds
--   tcl    {"key", "device_id"}                  learned by the bridge (BroadLink DNA auth)
--   tuya   {"device_id", "local_key", "version"} from the Tuya cloud or the user
--   haier  {"device_id", "local_key"}            from `haismart-keys` or the user
-- Kept out of `devices` so realtime change feeds and the dashboard never carry them.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.device_secrets (
  device_id text primary key references public.devices (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  secrets jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- The first app version stored the Tuya key in devices.local_key. Move the keys of owned rows here,
-- then drop the column so the key never rides along with a device row again.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'devices' and column_name = 'local_key'
  ) then
    insert into public.device_secrets (device_id, owner_id, secrets)
      select id, owner_id, jsonb_build_object('local_key', local_key)
      from public.devices
      where owner_id is not null and coalesce(local_key, '') <> ''
    on conflict (device_id) do nothing;
    alter table public.devices drop column local_key;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Commands: the app inserts one row per user action; whoever reaches the AC (the Home Bridge, the
-- phone on the same Wi-Fi, or the Tuya cloud function) runs it and records the outcome.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.device_commands (
  id bigint generated always as identity primary key,
  device_id text not null references public.devices (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  patch jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'expired')),
  executed_by text,
  error text,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create index if not exists device_commands_pending_idx
  on public.device_commands (owner_id, status, created_at)
  where status in ('pending', 'running');

-- ---------------------------------------------------------------------------------------------
-- Home Bridges: one row per running bridge, refreshed every few seconds as a heartbeat.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.bridges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  version text,
  host_info jsonb,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- ---------------------------------------------------------------------------------------------
-- Units a bridge found on the LAN that are not added yet. The app lists them under Add Device.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.discovered_devices (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  bridge_id uuid references public.bridges (id) on delete cascade,
  brand text not null,
  mac_address text not null,
  ip_address text not null,
  name text,
  model text,
  needs_key boolean not null default false,
  details jsonb,
  seen_at timestamptz not null default now(),
  unique (owner_id, brand, mac_address)
);

-- ---------------------------------------------------------------------------------------------
-- Telemetry tables from the first version, now scoped to their owner.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.user_activity (
  id bigserial primary key,
  action text not null,
  device_name text,
  details jsonb,
  created_at timestamptz default now()
);
alter table public.user_activity
  add column if not exists owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  add column if not exists user_id text;

create table if not exists public.error_logs (
  id bigserial primary key,
  error_type text not null,
  message text,
  device_brand text,
  device_ip text,
  created_at timestamptz default now()
);
alter table public.error_logs
  add column if not exists owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  add column if not exists user_id text,
  add column if not exists platform text,
  add column if not exists metadata jsonb;

-- ---------------------------------------------------------------------------------------------
-- Row level security: every table is visible and writable only by its owner. The anon key that
-- ships inside the APK and the dashboard can no longer read anyone else's ACs or keys.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'devices', 'device_secrets', 'device_commands', 'bridges', 'discovered_devices',
    'user_activity', 'error_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Policies are OR-ed, so any policy left from before (the first app version opened these
    -- tables to everyone as "Allow public ...", but names vary) would undo the owner rule.
    -- Drop every existing policy on the table, whatever its name, then add the owner ones.
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy "owner read" on public.%I for select using (owner_id = auth.uid())', t);
    execute format('create policy "owner insert" on public.%I for insert with check (owner_id = auth.uid())', t);
    execute format(
      'create policy "owner update" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
    execute format('create policy "owner delete" on public.%I for delete using (owner_id = auth.uid())', t);
  end loop;
end $$;

-- A command or secret may only point at a device the same user owns.
create or replace function public.ensure_device_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.devices d where d.id = new.device_id and d.owner_id = new.owner_id) then
    raise exception 'device % does not belong to this user', new.device_id;
  end if;
  return new;
end $$;

drop trigger if exists device_commands_owner on public.device_commands;
create trigger device_commands_owner before insert or update on public.device_commands
  for each row execute function public.ensure_device_owner();

drop trigger if exists device_secrets_owner on public.device_secrets;
create trigger device_secrets_owner before insert or update on public.device_secrets
  for each row execute function public.ensure_device_owner();

-- Keep updated_at honest without trusting the client clock.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists devices_touch on public.devices;
create trigger devices_touch before update on public.devices
  for each row execute function public.touch_updated_at();

drop trigger if exists device_secrets_touch on public.device_secrets;
create trigger device_secrets_touch before update on public.device_secrets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Realtime: the app and the bridge subscribe to these instead of polling.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['devices', 'device_commands', 'bridges', 'discovered_devices', 'user_activity', 'error_logs'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
