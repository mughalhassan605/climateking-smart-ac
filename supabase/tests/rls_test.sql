-- Checks that each user sees and changes only their own rows. Run after the migrations.
\set ON_ERROR_STOP on
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.devices (id, name, vendor, brand) values ('dev-a', 'A living room', 'Gree', 'gree');
insert into public.device_secrets (device_id, secrets) values ('dev-a', '{"gree":{"key":"k"}}');
insert into public.device_commands (device_id, patch) values ('dev-a', '{"isOn":true}');
insert into public.bridges (name) values ('home-pc');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
begin
  if (select count(*) from public.devices) <> 0 then raise exception 'user B can see user A devices'; end if;
  if (select count(*) from public.device_secrets) <> 0 then raise exception 'user B can see user A secrets'; end if;
  if (select count(*) from public.device_commands) <> 0 then raise exception 'user B can see user A commands'; end if;
  update public.devices set is_on = true where id = 'dev-a';
  if found then raise exception 'user B changed user A device'; end if;
  begin
    insert into public.device_commands (device_id, patch) values ('dev-a', '{"isOn":false}');
    raise exception 'user B queued a command for user A device';
  exception when raise_exception then
    if sqlerrm like 'user B%' then raise; end if;
  end;
  begin
    insert into public.devices (id, name, vendor, brand) values ('dev-x', 'x', 'X', 'carrier');
    raise exception 'unknown brand accepted';
  exception when check_violation then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  if (select count(*) from public.devices) <> 0 then raise exception 'anonymous caller can see devices'; end if;
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
begin
  if (select count(*) from public.devices) <> 1 then raise exception 'owner cannot see own device'; end if;
  update public.device_commands set status = 'done', executed_by = 'bridge', executed_at = now();
  if not found then raise exception 'owner cannot complete own command'; end if;
end $$;
reset role;

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'devices' and column_name = 'local_key') then
    raise exception 'local_key column still present';
  end if;
end $$;
select 'rls ok';
