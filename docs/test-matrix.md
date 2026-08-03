# GERAS — Test Matrix

Empirical evidence for Chapter 4. Each row is a scenario, an expected outcome,
and the artefact that proves the outcome held. **Rows 3 and 5 are the two
that carry the defence.**

- Row 3 shows a failure mode the proposal didn't name (throughput-blind
  `navigator.onLine`), and shows we handle it.
- Row 5 demonstrates the "bi-directional synchronization" objective concretely
  rather than asserting it in prose.

## Environment

- **Reporter:** Chrome 130+ / Safari 17+ on Android and iOS
- **Console:** Desktop Chrome / Firefox, dispatcher account with TOTP factor
- **SMS provider:** Africa's Talking sandbox — the sandbox simulator posts
  inbound SMS to `/api/sms-webhook` for free. Production shortcodes are paid
  and take days to provision; see §4 of the report on the intended production
  path.
- **Database:** Supabase project with PostGIS extension enabled, all three
  migrations applied.
- **Rate limit note:** the limiter is per-process in-memory. Row 8 assumes
  a single Vercel/Node instance; note this in the deployment section.

## Matrix

| #  | Scenario                                              | Expected                                                                              | Evidence artefact                     |
| -- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| 1  | Report on full 4G                                     | HTTPS path; row has `channel_first='https'`; marker appears in console < 3s           | reporter screenshot + `incidents` row |
| 2  | Airplane mode                                         | Probe fails within 4s; SMS app opens pre-filled with the GERAS payload                | phone screen recording                |
| 3  | Connected but ~zero throughput (DevTools 1 kbps)      | Probe times out at 3.5s; falls back to SMS. Proves `navigator.onLine` is insufficient | DevTools throttle capture             |
| 4  | Inbound SMS via AT sandbox                            | Parsed; incident created; appears on map with SMS badge                                | webhook log + console screenshot      |
| 5  | Same `ref` via SMS then HTTPS                         | **One** row; `channels_seen={sms,https}`; `channel_first` preserved from first arrival | before/after `select * from incidents where ref = ?` |
| 6  | Malformed SMS ("HELP THERE WAS A CRASH")              | `sms_inbox.parse_status = 'malformed'` with `error_code`; no incident row; webhook returns 200 | `sms_inbox` row                       |
| 7  | Cold GPS fix, no data                                 | Fix obtained offline < 60s; alert sent with accuracy flag if stale                    | timed phone video                     |
| 8  | 6 rapid reports from one device                       | 5 succeed; 6th returns 429 with `Retry-After`                                         | curl output showing 5x 201 + 1x 429   |
| 9  | Login without TOTP                                    | Rejected at the second factor; console layout redirects to `/login`                    | screenshot                            |
| 10 | Nearest-unit query                                    | Correct ordering by `st_distance`; ETA computed at 60 km/h                              | RPC output vs plain distance math     |

## How to run row 5 (the dedup demo)

1. Trigger a **SMS** inbound from the AT sandbox with a fixed `ref` (e.g.
   `A3F2K9`):
   ```
   GERAS A3F2K9 4.90570 7.85370 12 ACC 2 08031234567
   ```
   Verify: `select ref, channel_first, channels_seen from incidents where ref='A3F2K9';`
   → `A3F2K9 | sms | {sms}`
2. From the reporter (same `ref` — set it manually via devtools on `generateRef`
   or run curl):
   ```
   curl -X POST http://localhost:3000/api/report \
     -H 'content-type: application/json' \
     -d '{"ref":"A3F2K9","lat":4.90570,"lon":7.85370,"accuracy_m":8,"incident_type":"ACC","severity":2}'
   ```
   → response: `{"status":"merged", ...}`
3. Verify: same query
   → `A3F2K9 | sms | {sms,https}` and `accuracy_m` is now 8 (enriched from the second call).

## Row 3 — the throughput-blind failure mode

Reproducing the "connected but useless" carrier state:
1. DevTools → Network → **Throttling → Custom → Add: 1 kbps down/up, 2000 ms latency**
2. `navigator.onLine` still returns `true`; the health probe times out at 3.5s.
3. `failover.ts` treats the probe as authoritative and hands off to SMS.

This is exactly what §3 of the report calls out: `navigator.onLine` reports
that a network *interface* exists, not that data can move.

## Not-in-scope (state proactively per Chapter 5)

- Outbound driver alerting (§1.2 "warning nearby road users") — objectives
  (a)–(d) do not include it and this build does not implement it.
- SMS payload encryption — the SMS leg crosses AT in plaintext, a property
  of GSM. TLS 1.2+ on the data channel; payload-level encryption is future work.
