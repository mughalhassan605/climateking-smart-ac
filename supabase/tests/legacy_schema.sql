-- The tables as the first app version created them (README schema plus the columns the app wrote).
create table public.devices (
  id text primary key, name text not null, vendor text not null, brand text not null, model text,
  room_name text, ip_address text, mac_address text, local_key text, is_on boolean default false,
  mode text default 'cool', target_temp numeric default 24, current_temp numeric default 26,
  humidity numeric default 50, fan_speed text default 'auto', status text default 'online',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.user_activity (
  id bigserial primary key, user_id text, action text not null, device_name text, details jsonb,
  created_at timestamptz default now()
);
create table public.error_logs (
  id bigserial primary key, user_id text, error_type text not null, message text, device_brand text,
  device_ip text, platform text, metadata jsonb, created_at timestamptz default now()
);
insert into public.devices (id, name, vendor, brand, local_key) values
  ('legacy-1', 'Old Kenwood', 'Kenwood', 'tuya', 'abcdef0123456789'),
  ('legacy-2', 'Old Gree', 'Gree', 'gree', null);

-- The first version left the tables open to the anon key; one policy under an unexpected name too.
alter table public.devices enable row level security;
create policy "Allow public read devices" on public.devices for select using (true);
create policy "Allow public update devices" on public.devices for update using (true);
create policy "anyone can read" on public.devices for select using (true);
alter table public.user_activity enable row level security;
create policy "Allow public insert user_activity" on public.user_activity for insert with check (true);
