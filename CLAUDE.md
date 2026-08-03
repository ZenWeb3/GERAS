# GERAS — Build Spec (v2, Next.js)

**Hybrid Dual-Channel Geospatial Emergency Alert System for the FRSC**
Drop this in the repo root as `CLAUDE.md` and build against it.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v3 (not v4) · Supabase (Postgres + PostGIS + Auth + Realtime) · Leaflet · Africa's Talking.

> Deviates from the approved methodology §1.4(b), which specifies PHP + MySQL. Confirm with the author and supervisor before building, and amend §1.4(b)–(c) in the document. Justification for Chapter 3: PostGIS provides spheroid-accurate spatial querying over MySQL's planar spatial extensions, and push-based subscriptions remove dispatch latency inherent to polling.

---

## 0. The one deviation from the proposal (read first)

The proposal claims the PWA *automatically* sends an SMS on failover. **No browser can send SMS from JavaScript.** The Web SMS API only existed in Firefox OS and is dead.

Implementation: on failover the app builds an `sms:` URI with the payload pre-filled and hands off to the native messaging app. The user taps Send. Zero data required, one tap.

Write this up as **user-confirmed SMS dispatch** and frame the confirmation as the anti-hoax control that §3.1 (Authentication) calls for. Never say the app "switches to" SMS — say it "falls back to" or "hands off to" SMS.

---

## 1. Repo layout

```
geras/
├── app/
│   ├── (report)/page.tsx              # PWA reporter — road user
│   ├── console/
│   │   ├── page.tsx                   # dispatch console (auth-gated)
│   │   └── layout.tsx
│   ├── login/page.tsx                 # email+password → TOTP challenge
│   ├── api/
│   │   ├── health/route.ts            # connectivity probe
│   │   ├── report/route.ts            # primary channel ingest
│   │   ├── sms-webhook/route.ts       # Africa's Talking inbound
│   │   ├── incidents/route.ts         # list + status update
│   │   └── units/route.ts             # nearest available units
│   ├── manifest.ts
│   └── layout.tsx
├── components/
│   ├── reporter/{TypeGrid,SeverityDial,SendButton,ChannelStrip,SmsHandoff}.tsx
│   └── console/{IncidentMap,IncidentList,IncidentDrawer,UnitPanel}.tsx
├── lib/
│   ├── supabase/{client,server,admin}.ts
│   ├── geo.ts                         # watchPosition cache, ref generator
│   ├── net.ts                         # probe
│   ├── failover.ts                    # channel decision + sms: URI
│   ├── outbox.ts                      # IndexedDB queue (idb-keyval)
│   ├── sms-payload.ts                 # build + parse, shared client/server
│   └── types.ts
├── supabase/migrations/
│   ├── 001_schema.sql
│   └── 002_seed.sql
├── public/{sw.js,icons/}
├── tests/                             # vitest
│   ├── sms-payload.test.ts
│   └── dedup.test.ts
└── docs/test-matrix.md
```

Service worker: hand-rolled in `public/sw.js` and registered in a client component. Do not add `next-pwa` — it fights App Router and you don't have the hours.

---

## 2. The SMS payload format

Must survive a 160-char GSM-7 single segment and start with a keyword (shared shortcodes route by keyword).

```
GERAS <ref> <lat> <lon> <acc> <type> <sev> [phone]
```

Example: `GERAS A3F2K9 4.90570 7.85370 12 ACC 2 08031234567` — 44 chars.

| Field | Rule |
|---|---|
| `ref` | 6 chars, Crockford base32 (`0-9A-HJKMNP-TV-Z`), generated client-side. **The dedup key.** |
| `lat`/`lon` | 5 decimal places ≈ 1.1 m. Signed. |
| `acc` | GPS accuracy in metres, integer, clamp 9999 |
| `type` | `ACC` crash · `MED` medical · `FIR` fire · `BRK` breakdown · `OBS` obstruction |
| `sev` | 1 minor · 2 serious · 3 critical |
| `phone` | optional callback, 11-digit local or +234 |

`lib/sms-payload.ts` exports `buildPayload()` and `parsePayload()` and is imported by **both** the reporter and the webhook — one source of truth, and the unit tests cover the parser the client actually produces.

```ts
const PAYLOAD_RE = /^GERAS\s+([0-9A-HJKMNP-TV-Z]{6})\s+(-?\d{1,3}\.\d{1,6})\s+(-?\d{1,3}\.\d{1,6})\s+(\d{1,4})\s+(ACC|MED|FIR|BRK|OBS)\s+([1-3])(?:\s+(\+?\d{10,14}))?\s*$/i;
```

Bounds-check Nigeria: lat 4–14, lon 2–15. Reject and log anything failing.

---

## 3. Database (Supabase / PostGIS)

`001_schema.sql` — enable `postgis` first.

- **`incidents`** — `id uuid pk`, `ref char(6) unique not null`, `lat numeric(9,6)`, `lon numeric(9,6)`, `geom geography(Point,4326) not null` + **GIST index**, `accuracy_m int`, `incident_type incident_type_enum`, `severity smallint check (severity between 1 and 3)`, `reporter_phone text`, `device_id uuid`, `channel_first channel_enum`, `channels_seen channel_enum[] default '{}'`, `client_ts timestamptz`, `server_ts timestamptz default now()`, `status status_enum default 'new'`, `assigned_unit_id uuid`, `notes text`
- **`patrol_units`** — `callsign`, `station`, `phone`, `geom geography(Point,4326)` + GIST, `status`, `last_seen`
- **`incident_events`** — audit trail: `incident_id`, `actor`, `action`, `meta jsonb`, `created_at`. Append-only; no update or delete policy. This is the tamper-evidence story for the defence.
- **`sms_inbox`** — every inbound SMS raw: `provider_id unique`, `from_msisdn`, `text`, `received_at`, `parse_status`, `incident_id nullable`. `provider_id unique` also kills Africa's Talking retry duplicates for free.

Keep `lat`/`lon` **and** `geom` — `geom` for querying, the plain columns so Leaflet gets numbers without PostGIS decoding on the client. Populate `geom` in a `before insert` trigger.

**RLS:** enabled on every table. No anonymous insert path — the reporter posts to a route handler that uses the service-role key server-side. Dispatchers get select/update on `incidents` and `patrol_units` via an authenticated role. The service-role key never reaches the browser; it lives in `lib/supabase/admin.ts`, imported only by route handlers.

**Realtime:** enable on `incidents`. The console subscribes to inserts and updates.

Seed 6 patrol units on the Uyo–Ikot Ekpene and Uyo–Abak corridors, one dispatcher, and 8 historical incidents so no screenshot is ever of an empty map.

---

## 4. API (route handlers)

### `GET /api/health`
`return new Response('ok', { headers: { 'cache-control': 'no-store' } })`. No DB call. Add `export const runtime = 'edge'` — this is the probe, it has to be genuinely cheap and cold-start-free.

### `POST /api/report` — primary channel
Body: `{ref, lat, lon, accuracy_m, incident_type, severity, reporter_phone, device_id, client_ts}`.

Zod-validate, then **upsert on `ref`** via a Postgres function so the merge is atomic:

```sql
insert into incidents (...) values (...)
on conflict (ref) do update set
  channels_seen = array(select distinct unnest(incidents.channels_seen || 'https'::channel_enum)),
  reporter_phone = coalesce(incidents.reporter_phone, excluded.reporter_phone),
  accuracy_m     = coalesce(incidents.accuracy_m, excluded.accuracy_m),
  notes          = coalesce(incidents.notes, excluded.notes)
returning id, (xmax = 0) as created;
```

`channel_first` and `server_ts` are never overwritten — first arrival wins, later arrivals enrich. Return `{status: 'created' | 'merged', ref, id}`.

**That upsert is the "bi-directional synchronization" objective.** Say so explicitly in Chapter 4.

### `POST /api/sms-webhook` — failover channel
Africa's Talking posts `application/x-www-form-urlencoded`: `from`, `to`, `text`, `date`, `id`, `linkId`. Guard with a shared secret in the query string compared using `timingSafeEqual`.

Order matters: insert into `sms_inbox` **first**, then parse, then upsert into `incidents`. **Always return 200** — AT retries on non-200 and you'll get duplicate deliveries.

Add `export const runtime = 'nodejs'` (needs `crypto.timingSafeEqual`).

### `GET /api/incidents` · `PATCH /api/incidents`
List with filters; PATCH updates status/assignment and writes an `incident_events` row. Session required. The console primarily uses Realtime — this is the initial load and the fallback if the socket drops.

### `GET /api/units?lat=&lon=`
```sql
select *, st_distance(geom, st_point($2,$1)::geography)/1000 as km
from patrol_units where status = 'available'
order by geom <-> st_point($2,$1)::geography limit 5;
```
The `<->` operator uses the GIST index. ETA at 60 km/h. This is objective (d)'s dispatch coordination — cheap, demos extremely well.

**Rate limit** `/api/report` to 5/min per `device_id` and 20/min per IP. This is your hoax-injection control; without it the anti-hoax claim in Chapter 4 is unsupported.

---

## 5. The failover logic (the core of the project)

`lib/failover.ts`, on submit:

1. **Position.** Use the cached `watchPosition` fix if < 30 s old and accuracy < 100 m. Otherwise `getCurrentPosition({enableHighAccuracy: true, timeout: 8000, maximumAge: 30000})`. On timeout fall back to the last cached fix and flag it in the UI. **Never block the alert waiting for a perfect lock** — a cold GNSS fix with no A-GPS assistance can take 30–60 s, which is exactly the wrong minute.
2. **Generate `ref`**, write the full incident to IndexedDB as `pending`. Nothing is lost if the tab dies.
3. **Probe** — do not trust `navigator.onLine`:
   ```ts
   const ok = await fetch(`/api/health?t=${Date.now()}`, {
     cache: 'no-store', signal: AbortSignal.timeout(3500)
   }).then(r => r.ok).catch(() => false);
   ```
   `navigator.onLine` only reports that a network interface exists. Nigerian networks return "online" with zero throughput constantly. Use it as a **fast negative only** — if false, skip the probe and go straight to SMS.
4. **Primary:** probe passed → `POST /api/report`, 6 s timeout, one retry. Success → `sent_https`, show the ref code.
5. **Failover:** probe failed, or POST failed twice → build the payload, mark `sms_attempted`, and hand off:
   ```ts
   const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?';
   window.location.href = `sms:${SHORTCODE}${sep}body=${encodeURIComponent(payload)}`;
   ```
   Then render full-screen: **"Your messaging app is opening. Tap Send to alert FRSC."** with the payload shown as selectable text as a last resort.
6. **Reconciliation:** on the `online` event (and via Background Sync where supported), re-POST everything in `pending` or `sms_attempted`. The server merges on `ref` — no duplicate incident, and the SMS-origin record gets enriched with what 160 characters couldn't carry.

Service worker: precache the app shell, `NetworkOnly` for `/api/*`, offline fallback. **The reporter must open and function with the radio off** — test it that way, not just with DevTools throttling.

---

## 6. UI direction

Tailwind **v3**, not v4.

**Reporter** — one job: fire an alert while someone is panicking on a roadside. Single screen, no scroll, no login, no onboarding. Five large incident-type tiles, a three-step severity control, one full-width send button ≥ 72 px tall in the bottom third where a thumb reaches. High contrast for direct sunlight. Persistent status strip at top showing GPS accuracy in metres and the channel that will be used (`Data` / `SMS fallback`), so the user always knows which path their alert takes. No spinner without text — every wait state names what is happening.

**Console** — operations room. Dark surface, Leaflet with OSM tiles (`dynamic(() => import(...), { ssr: false })` — Leaflet touches `window` at module scope and will break the build otherwise). Incident list docked left, map right, detail drawer on select. Severity encoded by colour **and** shape, never colour alone. **Channel badge on every marker and row** — SMS-origin incidents visually distinct, because demonstrating that the fallback path lands in the same pipeline is the entire thesis. New incident: brief marker pulse, one audio ping, count in the tab title. Respect `prefers-reduced-motion`.

Palette: deep slate console ground, one high-alarm accent for critical, amber for serious, muted teal for minor, and a distinct colour reserved **only** for the SMS channel badge. Spend the accent nowhere else. Type: a condensed face with tabular numerals for coordinates and callsigns, a neutral face for everything else.

---

## 7. Build order (~36 hours)

**Block 1 — data + parser.** `001_schema.sql` with PostGIS, enums, RLS, the trigger, seed data. `lib/sms-payload.ts`. Then `tests/sms-payload.test.ts` (valid, malformed, out-of-bounds, wrong keyword, missing optional phone) and `tests/dedup.test.ts` (same ref both channels → one row, `channels_seen = {https,sms}`). **Get these green before any UI exists.** Everything downstream assumes the merge works.

**Block 2 — API.** `health`, `report` with the upsert function, `sms-webhook`, `incidents`, `units`. Verify each with `curl` before wiring a frontend to it.

**Block 3 — console.** Supabase Auth with TOTP MFA enrollment, login flow, Leaflet map, Realtime subscription, list, drawer, status transitions, nearest-unit panel.

**Block 4 — reporter.** `geo.ts`, `net.ts`, `outbox.ts`, `failover.ts`, service worker, manifest, icons. Test in real airplane mode on a physical phone, not just DevTools.

**Block 5 — integration + evidence.** Africa's Talking **sandbox** (production shortcodes are paid and take days to provision; the sandbox simulator posts inbound SMS to your webhook for free — note the production path in Chapter 4 rather than implying you had it). Run the test matrix, capture screenshots, write `docs/test-matrix.md`.

---

## 8. Test matrix — this becomes Chapter 4

| # | Scenario | Expected | Evidence |
|---|---|---|---|
| 1 | Report on full 4G | HTTPS path, `channel_first='https'`, marker < 3 s | screenshot + row |
| 2 | Airplane mode | Probe fails < 4 s, SMS app opens pre-filled | phone video |
| 3 | Connected, ~zero throughput (throttle 1 kbps) | Probe times out, falls back to SMS — proves `navigator.onLine` insufficient | DevTools capture |
| 4 | Inbound SMS via AT sandbox | Parsed, incident created, appears on map with SMS badge | webhook log + screenshot |
| 5 | Same `ref` via SMS then HTTPS | **One** row, `channels_seen={https,sms}` | before/after query |
| 6 | Malformed SMS | Logged `malformed` in `sms_inbox`, no incident, 200 returned | row |
| 7 | Cold GPS fix, no data | Fix obtained offline < 60 s, alert sent with accuracy flag | timed video |
| 8 | 6 rapid reports, one device | Rate limited after 5 | HTTP 429 |
| 9 | Login without TOTP | Rejected at second factor | screenshot |
| 10 | Nearest-unit query | Correct ordering by `st_distance` | query output |

**Rows 3 and 5 win the defence.** Row 3 shows a failure mode the proposal didn't name. Row 5 demonstrates the synchronisation objective rather than asserting it.

---

## 9. Honest security scoping

Do **not** claim end-to-end encryption. The SMS leg crosses Africa's Talking in plaintext; that's a property of GSM, not a bug you can fix. Claim and implement:

- TLS 1.2+ in transit on the data channel
- Supabase Auth with **TOTP MFA** for all dispatcher access
- Row Level Security on every table; service-role key server-side only
- Parameterised queries throughout, Zod validation, geographic bounds checks
- Shared-secret webhook auth with `timingSafeEqual`
- Per-device and per-IP rate limiting as the hoax-injection control
- Append-only `incident_events` as tamper evidence

Then add one paragraph naming SMS plaintext transit as a known limitation, with payload-level encryption proposed as future work. Flagging a gap yourself reads as rigour; being caught claiming to have closed one does not.

---

## 10. Deployment

Vercel or pxxl, either is fine. **HTTPS is mandatory** — the Geolocation API refuses insecure origins, so there is no plain-HTTP demo. Point the Africa's Talking callback at `https://<host>/api/sms-webhook?k=<secret>`. Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AT_WEBHOOK_SECRET`, `NEXT_PUBLIC_SMS_SHORTCODE`.

---

## 11. Scope boundary

§1.2 of the proposal mentions warning "nearby road users" of incidents ahead. Objectives (a)–(d) do not include it and neither does this build. Outbound driver alerting is **future work** — state that proactively in Chapter 5 rather than waiting to be asked.