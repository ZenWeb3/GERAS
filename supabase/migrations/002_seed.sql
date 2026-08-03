-- GERAS seed — Block 1
-- 6 patrol units on the Uyo–Ikot Ekpene and Uyo–Abak corridors, plus
-- 8 historical incidents so no screenshot is ever of an empty map.

-- Patrol units ---------------------------------------------------------

insert into patrol_units (callsign, station, phone, geom, status) values
  ('RS6-01', 'Uyo',         '+2348030000101', st_setsrid(st_makepoint(7.9337, 5.0378), 4326)::geography, 'available'),
  ('RS6-02', 'Uyo',         '+2348030000102', st_setsrid(st_makepoint(7.8850, 5.0450), 4326)::geography, 'available'),
  ('RS6-03', 'Ikot Ekpene', '+2348030000103', st_setsrid(st_makepoint(7.7180, 5.1810), 4326)::geography, 'available'),
  ('RS6-04', 'Ikot Ekpene', '+2348030000104', st_setsrid(st_makepoint(7.7900, 5.1200), 4326)::geography, 'dispatched'),
  ('RS6-05', 'Abak',        '+2348030000105', st_setsrid(st_makepoint(7.7830, 4.9770), 4326)::geography, 'available'),
  ('RS6-06', 'Abak',        '+2348030000106', st_setsrid(st_makepoint(7.8500, 5.0100), 4326)::geography, 'onscene')
on conflict (callsign) do nothing;

-- Historical incidents -------------------------------------------------

insert into incidents
  (ref, lat, lon, accuracy_m, incident_type, severity, reporter_phone,
   channel_first, channels_seen, client_ts, server_ts, status)
values
  ('A1B2C3', 5.0378, 7.9337, 12, 'ACC', 3, '+2348031234501', 'https', array['https']::channel_enum[], now() - interval '9 days',  now() - interval '9 days',  'resolved'),
  ('D4E5F6', 5.1810, 7.7180, 18, 'MED', 2, '+2348031234502', 'sms',   array['sms']::channel_enum[],   now() - interval '7 days',  now() - interval '7 days',  'resolved'),
  ('G7H8J9', 5.0450, 7.8850, 25, 'BRK', 1, null,             'https', array['https']::channel_enum[], now() - interval '6 days',  now() - interval '6 days',  'resolved'),
  ('K1M2N3', 4.9770, 7.7830, 14, 'OBS', 1, '+2348031234504', 'sms',   array['sms','https']::channel_enum[], now() - interval '5 days', now() - interval '5 days', 'resolved'),
  ('P4Q5R6', 5.1200, 7.7900, 33, 'FIR', 3, '+2348031234505', 'https', array['https']::channel_enum[], now() - interval '3 days',  now() - interval '3 days',  'resolved'),
  ('S7T8V9', 5.0100, 7.8500, 11, 'ACC', 2, null,             'sms',   array['sms']::channel_enum[],   now() - interval '2 days',  now() - interval '2 days',  'resolved'),
  ('W1X2Y3', 5.0500, 7.9100, 20, 'MED', 2, '+2348031234507', 'https', array['https']::channel_enum[], now() - interval '18 hours', now() - interval '18 hours', 'dispatched'),
  ('Z4A5B6', 5.0900, 7.8000, 15, 'ACC', 3, '+2348031234508', 'https', array['https']::channel_enum[], now() - interval '2 hours',  now() - interval '2 hours',  'new')
on conflict (ref) do nothing;
