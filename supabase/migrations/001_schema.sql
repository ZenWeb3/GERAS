-- GERAS schema — Block 1
-- PostGIS gives us spheroid-accurate spatial querying (see CLAUDE.md §0).

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- Enums -----------------------------------------------------------------

do $$ begin
  create type incident_type_enum as enum ('ACC','MED','FIR','BRK','OBS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type channel_enum as enum ('https','sms');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_enum as enum ('new','triaged','dispatched','onscene','resolved','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unit_status_enum as enum ('available','dispatched','onscene','offline');
exception when duplicate_object then null; end $$;

-- Tables ----------------------------------------------------------------

create table if not exists incidents (
  id                uuid primary key default gen_random_uuid(),
  ref               char(6) not null unique,
  lat               numeric(9,6) not null,
  lon               numeric(9,6) not null,
  geom              geography(Point,4326) not null,
  accuracy_m        int,
  incident_type     incident_type_enum not null,
  severity          smallint not null check (severity between 1 and 3),
  reporter_phone    text,
  device_id         uuid,
  channel_first     channel_enum not null,
  channels_seen     channel_enum[] not null default '{}',
  client_ts         timestamptz,
  server_ts         timestamptz not null default now(),
  status            status_enum not null default 'new',
  assigned_unit_id  uuid,
  notes             text
);

create index if not exists incidents_geom_gix on incidents using gist (geom);
create index if not exists incidents_server_ts_idx on incidents (server_ts desc);
create index if not exists incidents_status_idx on incidents (status);

create table if not exists patrol_units (
  id          uuid primary key default gen_random_uuid(),
  callsign    text not null unique,
  station     text not null,
  phone       text,
  geom        geography(Point,4326) not null,
  status      unit_status_enum not null default 'available',
  last_seen   timestamptz not null default now()
);

create index if not exists patrol_units_geom_gix on patrol_units using gist (geom);
create index if not exists patrol_units_status_idx on patrol_units (status);

alter table incidents
  add constraint incidents_assigned_unit_fk
  foreign key (assigned_unit_id) references patrol_units(id) on delete set null
  not valid;

create table if not exists incident_events (
  id           uuid primary key default gen_random_uuid(),
  incident_id  uuid not null references incidents(id) on delete cascade,
  actor        text not null,
  action       text not null,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists incident_events_incident_idx on incident_events (incident_id, created_at);

create table if not exists sms_inbox (
  id            uuid primary key default gen_random_uuid(),
  provider_id   text not null unique,
  from_msisdn   text not null,
  text          text not null,
  received_at   timestamptz not null default now(),
  parse_status  text not null,
  error_code    text,
  incident_id   uuid references incidents(id) on delete set null
);

create index if not exists sms_inbox_received_idx on sms_inbox (received_at desc);

-- Triggers --------------------------------------------------------------

create or replace function set_incident_geom() returns trigger
language plpgsql as $$
begin
  new.geom := st_setsrid(st_makepoint(new.lon, new.lat), 4326)::geography;
  return new;
end $$;

drop trigger if exists trg_incidents_geom on incidents;
create trigger trg_incidents_geom
  before insert or update of lat, lon on incidents
  for each row execute function set_incident_geom();

-- Atomic upsert-on-ref used by both /api/report and /api/sms-webhook.
-- First arrival wins channel_first/server_ts; later arrivals enrich.
create or replace function upsert_incident(
  p_ref             char(6),
  p_lat             numeric,
  p_lon             numeric,
  p_accuracy_m      int,
  p_incident_type   incident_type_enum,
  p_severity        smallint,
  p_reporter_phone  text,
  p_device_id       uuid,
  p_channel         channel_enum,
  p_client_ts       timestamptz,
  p_notes           text default null
) returns table (id uuid, created boolean, ref char(6))
language plpgsql as $$
begin
  -- CTE aliases dodge the RETURNING/OUT-column name collision on `ref`.
  return query
  with upserted as (
    insert into incidents (
      ref, lat, lon, accuracy_m, incident_type, severity,
      reporter_phone, device_id, channel_first, channels_seen,
      client_ts, notes
    ) values (
      p_ref, p_lat, p_lon, p_accuracy_m, p_incident_type, p_severity,
      p_reporter_phone, p_device_id, p_channel, array[p_channel]::channel_enum[],
      p_client_ts, p_notes
    )
    on conflict (ref) do update set
      channels_seen  = (
        select array(select distinct unnest(incidents.channels_seen || excluded.channels_seen))
      ),
      reporter_phone = coalesce(incidents.reporter_phone, excluded.reporter_phone),
      accuracy_m     = coalesce(incidents.accuracy_m,     excluded.accuracy_m),
      notes          = coalesce(incidents.notes,          excluded.notes),
      -- keep the earliest client_ts if both provided one
      client_ts      = least(incidents.client_ts, excluded.client_ts)
    returning
      incidents.id  as u_id,
      (xmax = 0)    as u_created,
      incidents.ref as u_ref
  )
  select u_id, u_created, u_ref from upserted;
end $$;

-- Row Level Security ----------------------------------------------------
-- No anonymous insert path — the reporter posts to a route handler that
-- uses the service_role key server-side. Dispatchers get read/update via
-- the authenticated role.

alter table incidents        enable row level security;
alter table patrol_units     enable row level security;
alter table incident_events  enable row level security;
alter table sms_inbox        enable row level security;

do $$ begin
  create policy incidents_read_auth on incidents
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy incidents_update_auth on incidents
    for update to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy units_read_auth on patrol_units
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy units_update_auth on patrol_units
    for update to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy events_read_auth on incident_events
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- incident_events: append-only (tamper evidence). No update / delete policy is
-- created, so authenticated users cannot mutate history. Inserts are performed
-- by the service_role from the API layer.

do $$ begin
  create policy sms_inbox_read_auth on sms_inbox
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Realtime publication --------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table incidents;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table patrol_units;
exception when duplicate_object then null; when others then null; end $$;
