-- Fix: RETURN QUERY inside a plpgsql function whose OUT column is named `ref`
-- collides with `incidents.ref` in the RETURNING clause. Wrap the upsert in a
-- CTE with aliased column names, then SELECT them out — the outer SELECT
-- resolves cleanly against the function's OUT columns.

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
      client_ts      = least(incidents.client_ts, excluded.client_ts)
    returning
      incidents.id  as u_id,
      (xmax = 0)    as u_created,
      incidents.ref as u_ref
  )
  select u_id, u_created, u_ref from upserted;
end $$;
