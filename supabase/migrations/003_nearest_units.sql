-- GERAS — nearest-unit RPC (used by /api/units)
-- Uses the GIST <-> operator so ordering hits the index. ETA at 60 km/h is
-- computed in JS on the API side — kept out of the SQL so it's obvious.

create or replace function nearest_units(
  p_lat    numeric,
  p_lon    numeric,
  p_limit  int default 5
) returns table (
  id         uuid,
  callsign   text,
  station    text,
  phone      text,
  lat        numeric,
  lon        numeric,
  status     unit_status_enum,
  last_seen  timestamptz,
  km         numeric
) language sql stable as $$
  select
    u.id, u.callsign, u.station, u.phone,
    st_y(u.geom::geometry)::numeric as lat,
    st_x(u.geom::geometry)::numeric as lon,
    u.status, u.last_seen,
    (st_distance(u.geom, st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography) / 1000)::numeric(10,2) as km
  from patrol_units u
  where u.status = 'available'
  order by u.geom <-> st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography
  limit greatest(1, least(p_limit, 20));
$$;
