# GERAS

**Hybrid Dual-Channel Geospatial Emergency Alert System for the Federal Road Safety Corps (FRSC).**

A road user in trouble taps one button. The alert reaches the dispatch console over data if the network is up, or over SMS if it isn't — and if both arrive, they merge into a single incident on the same `ref`. Dispatchers see incidents live, triage them, and assign the nearest patrol.

- **Reporter** (public PWA, no login): `/report`
- **Dispatch console** (auth + TOTP MFA): `/console`
- **Two ingest paths** that reconcile server-side: `/api/report` (HTTPS) and `/api/sms-webhook` (Africa's Talking)

---

## Table of contents

1. [Why two channels](#why-two-channels)
2. [Stack](#stack)
3. [Repo layout](#repo-layout)
4. [Local setup](#local-setup)
5. [Running](#running)
6. [Testing on a phone (HTTPS + AT sandbox)](#testing-on-a-phone-https--at-sandbox)
7. [The SMS payload format](#the-sms-payload-format)
8. [Failover flow (client)](#failover-flow-client)
9. [Server-side dedup / merge](#server-side-dedup--merge)
10. [API reference](#api-reference)
11. [Database schema](#database-schema)
12. [Security scoping (what's claimed and what isn't)](#security-scoping)
13. [Test matrix](#test-matrix)
14. [Deployment](#deployment)
15. [Known deviations from the proposal](#known-deviations-from-the-proposal)
16. [Not in scope](#not-in-scope)

---

## Why two channels

The Nigerian mobile network gives you three states, not two: **online**, **offline**, and **online with zero throughput**. `navigator.onLine` cannot tell you which of the last two you're in — it only reports whether an interface exists. So the reporter probes `/api/health` with a 3.5s timeout every submission. If the probe fails, we don't retry over data forever — we build an SMS payload that fits a single GSM-7 segment and hand off to the OS messaging app.

The proposal called for the app to "send an SMS automatically" on failover. **No browser API for that exists.** The one that used to (Firefox OS Web SMS) is dead. What we do instead is called **user-confirmed SMS dispatch**: `sms:15629?body=GERAS%20...` pre-fills the message, the user taps Send. That confirmation doubles as the anti-hoax control CLAUDE.md §3.1 asks for.

---

## Stack

| Layer         | Tech |
| ------------- | ---- |
| Framework     | Next.js 15 (App Router), React 19 RC |
| Language      | TypeScript (strict) |
| Styling       | Tailwind v3 (NOT v4 — v4 fights the App Router) |
| Database      | Postgres (via Supabase) with **PostGIS** for spheroid-accurate spatial queries |
| Auth          | Supabase Auth + TOTP MFA (AAL2 required on dispatcher routes) |
| Realtime      | Supabase Realtime (postgres_changes) |
| Maps          | Leaflet + OpenStreetMap tiles |
| Offline queue | IndexedDB via `idb-keyval` |
| SMS provider  | Africa's Talking (sandbox for dev, production for demo) |
| Tests         | Vitest (unit + dedup contract) |

---

## Repo layout

```
geras/
├── app/
│   ├── page.tsx                 # landing (two CTAs)
│   ├── report/page.tsx          # PWA reporter — road user
│   ├── login/page.tsx           # password → TOTP (enrol on first login)
│   ├── console/
│   │   ├── layout.tsx           # gates every child on AAL2 session
│   │   └── page.tsx             # dispatcher shell
│   ├── api/
│   │   ├── health/route.ts      # edge probe, no DB
│   │   ├── report/route.ts      # HTTPS ingest — Zod + rate-limit + upsert
│   │   ├── sms-webhook/route.ts # AT webhook — inbox first, always 200
│   │   ├── incidents/route.ts   # dispatcher GET (list) + PATCH (status/assign)
│   │   └── units/route.ts       # nearest available patrols
│   ├── manifest.ts              # PWA manifest
│   ├── layout.tsx               # root
│   └── globals.css
├── components/
│   ├── reporter/{TypeGrid,SeverityDial,SendButton,ChannelStrip,SmsHandoff}.tsx
│   └── console/{ConsoleShell,IncidentList,IncidentMap,IncidentDrawer,UnitPanel}.tsx
├── lib/
│   ├── sms-payload.ts           # buildPayload / parsePayload — SHARED client + server
│   ├── failover.ts              # channel decision, retry, SMS handoff, reconcile
│   ├── geo.ts                   # watchPosition cache with hard 8s ceiling
│   ├── net.ts                   # /api/health probe with AbortSignal.timeout
│   ├── outbox.ts                # IDB queue + stable device_id
│   ├── rate-limit.ts            # in-process sliding window
│   ├── format.ts                # coord/ago/label helpers
│   ├── env.ts                   # env accessors (build-safe placeholders)
│   ├── types.ts                 # shared TS types
│   └── supabase/
│       ├── client.ts            # browser
│       ├── server.ts            # SSR (cookies)
│       └── admin.ts             # SERVICE ROLE — only import from route handlers
├── public/
│   ├── sw.js                    # service worker (shell precache, NetworkOnly /api/*)
│   ├── offline.html             # standalone offline shell
│   └── icons/                   # PWA launcher icons
├── supabase/migrations/
│   ├── 001_schema.sql           # PostGIS, enums, RLS, upsert RPC, Realtime pub
│   ├── 002_seed.sql             # 6 patrols + 8 historical incidents
│   ├── 003_nearest_units.sql    # RPC for /api/units
│   ├── 004_upsert_fix.sql       # RPC iteration (CTE approach; superseded)
│   └── 005_upsert_pragma.sql    # #variable_conflict use_column — the fix in prod
├── tests/
│   ├── sms-payload.test.ts      # 20 parser/builder tests
│   └── dedup.test.ts            # 7 merge-contract tests mirroring SQL rules
├── docs/
│   ├── test-matrix.md           # Chapter 4 evidence table
│   └── security-scoping.md      # honest claims table
├── .env.example                 # copy to .env.local and fill in
└── package.json
```

---

## Local setup

### 1. Prerequisites

- Node 20+ (`node -v`)
- pnpm 9+ (`pnpm -v`) — install with `npm i -g pnpm` if you don't have it
- A **Supabase** project (free tier is fine) — sign up at https://supabase.com
- An **Africa's Talking** account for SMS testing — sign up at https://africastalking.com (sandbox is free)

### 2. Clone + install

```bash
git clone https://github.com/ZenWeb3/GERAS.git
cd GERAS
pnpm install
```

### 3. Environment

Copy the example and fill in:

```bash
cp .env.example .env.local
```

Fill each variable:

| Var | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → your project → Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → **anon public** key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → **service_role secret** key. **Never expose this to the browser.** |
| `AT_WEBHOOK_SECRET` | Any long random string. Generate with `openssl rand -hex 32`. |
| `NEXT_PUBLIC_SMS_SHORTCODE` | The number the reporter's `sms:` URI addresses. Use `15629` for AT sandbox. |

### 4. Apply DB migrations

Open Supabase → **SQL Editor** → **New query** → paste and run each file **in order**:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_seed.sql`
3. `supabase/migrations/003_nearest_units.sql`
4. `supabase/migrations/005_upsert_pragma.sql` (skip 004 — it's a superseded iteration kept for audit)

After migration 002 runs you should see 6 patrol units and 8 historical incidents populated. The console will have data on first load.

### 5. Create a dispatcher account

Supabase Auth users can be created via the admin API. Two options:

**Option A — one-shot curl (recommended):**

```bash
SUPABASE_URL="<your project url>"
SERVICE_KEY="<your service role key>"

curl -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "content-type: application/json" \
  -d '{
    "email":"dispatcher@geras.local",
    "password":"Dispatch#2026!",
    "email_confirm":true,
    "user_metadata":{"role":"dispatcher","station":"Uyo"}
  }'
```

**Option B — Supabase dashboard:** Authentication → Users → Add user → Create new user → tick "Auto-confirm email".

---

## Running

```bash
pnpm dev        # http://localhost:3000
pnpm test       # 27 unit tests (parser + dedup contract)
pnpm typecheck  # tsc --noEmit
pnpm build      # production build
pnpm start      # serve the build
```

### The four pages

| Route | Auth | Description |
| ----- | ---- | ----------- |
| `/` | none | Landing — links to the two flows |
| `/report` | none | PWA reporter. GPS + type + severity + Send |
| `/login` | none → creates session | Email + password → TOTP challenge / enrol |
| `/console` | requires AAL2 | Dispatcher view — list + map + drawer + assignment |

### First login (TOTP)

1. `/login` → email + password → **Continue**
2. If no TOTP factor exists, a QR + secret appear
3. Scan the QR with an authenticator app **or** paste the secret into https://totp.danhersam.com/ (browser-side TOTP, no install)
4. Enter the 6-digit code → land on `/console`

Subsequent logins skip enrolment and go straight to the code prompt.

---

## Testing on a phone (HTTPS + AT sandbox)

The reporter needs **HTTPS** to use the browser Geolocation API and to register the service worker. Chrome allows both on `localhost` but not on plain-HTTP LAN IPs. Two ways:

### Cloudflared tunnel (recommended, no cert warnings)

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the printed `https://<random-words>.trycloudflare.com` URL. Open it on your phone. GPS + PWA install + service worker all work.

### Next's experimental HTTPS + LAN

```bash
pnpm exec next dev --experimental-https -H 0.0.0.0
```

Open `https://<your-computer-ip>:3000/report` on your phone. First visit shows a certificate warning — Advanced → Proceed.

### Point Africa's Talking at your tunnel

1. AT dashboard → **SMS → Callback URLs → Incoming Messages** → paste:
   ```
   https://<your-cloudflared-url>/api/sms-webhook?k=<your AT_WEBHOOK_SECRET>
   ```
2. AT sandbox routes inbound SMS through a **reserved shortcode**. Under **SMS → Shortcodes**, reserve one (sandbox codes are free and instant) — use it as `NEXT_PUBLIC_SMS_SHORTCODE` in `.env.local` and restart `pnpm dev`.
3. Send a test SMS from **Tools → Launch Simulator**:
   ```
   GERAS X9Y8Z7 5.03780 7.93370 15 FIR 3 08039998888
   ```
4. Watch `/console` in another browser tab — the marker pulses in via Realtime.

If AT sandbox routing gives you trouble (a common time sink), you can bypass it entirely and prove the pipeline works with a direct curl to your webhook — the shape is identical to what AT sends:

```bash
SECRET=$(grep '^AT_WEBHOOK_SECRET=' .env.local | cut -d= -f2)
curl -X POST "http://localhost:3000/api/sms-webhook?k=${SECRET}" \
  -d "id=sim-$(date +%s)&from=%2B2348030001234&text=GERAS+X1Y2Z3+5.03500+7.90000+15+ACC+3+08031234567&date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

---

## The SMS payload format

Fits **one GSM-7 single segment (≤160 chars)** and starts with a keyword so shared-shortcode routing works.

```
GERAS <ref> <lat> <lon> <acc> <type> <sev> [phone]
```

Example (44 chars):

```
GERAS A3F2K9 4.90570 7.85370 12 ACC 2 08031234567
```

| Field | Rule |
| --- | --- |
| `ref` | 6 chars, Crockford base32 (`0-9A-HJKMNP-TV-Z` — no I, L, O, U). **This is the dedup key.** |
| `lat` / `lon` | 5 decimal places ≈ 1.1 m precision. Signed. |
| `acc` | GPS accuracy in metres, integer, clamp 9999 |
| `type` | `ACC` crash · `MED` medical · `FIR` fire · `BRK` breakdown · `OBS` obstruction |
| `sev` | `1` minor · `2` serious · `3` critical |
| `phone` | Optional callback, 10–14 digits, optional leading `+` |

Nigeria bounds enforced at parse time: lat 4–14, lon 2–15. Anything outside is logged and rejected.

`lib/sms-payload.ts` exports `buildPayload()` and `parsePayload()` and is imported by **both** the reporter client and the webhook — one source of truth, and the 20 parser tests exercise the exact code the client produces.

---

## Failover flow (client)

On submit, `lib/failover.ts` runs this sequence:

1. **Position.** Use the cached `watchPosition` fix if it's <30 s old and <100 m accuracy. Otherwise call `getCurrentPosition` with an **8 s hard ceiling**. On timeout, fall back to the last cached fix and flag it stale in the UI. Never block the alert waiting for a perfect GNSS lock — a cold fix with no A-GPS assistance can take a minute, which is exactly the wrong minute.
2. **Generate `ref`** (Crockford base32) and write the full incident to IndexedDB as `pending`. Nothing is lost if the tab dies.
3. **Probe** `/api/health` with `AbortSignal.timeout(3500)`. If `navigator.onLine === false`, skip the probe (fast-negative only).
4. **Primary path:** POST `/api/report`, 6 s timeout, one retry. On success → mark `sent_https`, drop from queue, show ref.
5. **Failover:** on probe fail or two POST fails → build the SMS payload, mark `sms_attempted`, and hand off:
   ```ts
   const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?';
   window.location.href = `sms:${SHORTCODE}${sep}body=${encodeURIComponent(payload)}`;
   ```
   Then render a full-screen "Your messaging app is opening" sheet with the payload rendered as selectable text as a last resort.
6. **Reconciliation:** on the `online` event, `reconcile()` re-POSTs everything in `pending` / `sms_attempted`. The server merges on `ref`, so no duplicates.

---

## Server-side dedup / merge

The `upsert_incident` PL/pgSQL function is called by both `/api/report` and `/api/sms-webhook`. It performs one atomic `INSERT ... ON CONFLICT (ref) DO UPDATE`:

- **First arrival wins** `channel_first` and `server_ts` — these are never overwritten
- **Later arrivals enrich** `reporter_phone`, `accuracy_m`, `notes` if the first arrival left them null
- `channels_seen` is `array_distinct(existing || excluded)` — always ends up as `{sms}`, `{https}`, or `{sms,https}`
- `client_ts` becomes the earliest of the two arrivals

This atomicity is **the "bi-directional synchronization" objective in Chapter 3**, implemented in one Postgres statement. Row 5 of the test matrix demonstrates it end-to-end.

The RPC uses `#variable_conflict use_column` to resolve the name collision between the OUT parameter `ref` and `incidents.ref` in the ON CONFLICT / RETURNING clauses.

---

## API reference

### `GET /api/health` (edge runtime)

Returns `200 ok` with `cache-control: no-store`. No DB call. Purpose: the reporter's connectivity probe.

### `POST /api/report`

Primary channel ingest. Zod validates the body, applies **5/min per `device_id`** and **20/min per IP** rate limits (the hoax-injection control), then calls `upsert_incident` with `p_channel = 'https'`. Writes an append-only `incident_events` row (`created` or `merged`).

Body:
```json
{
  "ref": "A3F2K9",
  "lat": 4.90570,
  "lon": 7.85370,
  "accuracy_m": 12,
  "incident_type": "ACC",
  "severity": 2,
  "reporter_phone": "+2348031234567",
  "device_id": "uuid",
  "client_ts": "2026-08-05T12:00:00Z",
  "notes": "optional"
}
```

Response: `{ status: 'created' | 'merged', id, ref }` (201 or 200). Rate-limited: `429` with `Retry-After`.

### `POST /api/sms-webhook` (node runtime — needs `crypto.timingSafeEqual`)

Accepts both AT sandbox JSON and AT production `application/x-www-form-urlencoded`. Guard: shared secret in `?k=` compared constant-time. Wrong secret → silent `200` (no leak of whether the secret exists).

Ordering: **insert into `sms_inbox` first** (audit + retry dedup via `provider_id` unique), **then parse**, **then upsert into `incidents`**. **Always returns `200`** — AT retries on non-200 and duplicates are painful to clean up.

### `GET /api/incidents?status=&since=&limit=`

Session-gated. Returns latest incidents. Used for initial load and Realtime-drop fallback.

### `PATCH /api/incidents`

Session-gated. Body `{ id, status?, assigned_unit_id?, notes? }`. Updates via authenticated RLS. Audit row written via service-role client so the append-only tamper trail cannot be bypassed.

### `GET /api/units?lat=&lon=&limit=`

Session-gated. Calls `nearest_units` RPC which uses the GIST `<->` operator so ordering hits the index. ETA at 60 km/h computed in JS on the API side.

---

## Database schema

Enable `postgis` and `pgcrypto`. Enums: `incident_type_enum`, `channel_enum`, `status_enum`, `unit_status_enum`.

**`incidents`** — id, ref (unique), lat, lon, **geom** (`geography(Point,4326)` + GIST), accuracy_m, incident_type, severity (1–3 check), reporter_phone, device_id, channel_first, channels_seen (array), client_ts, server_ts, status, assigned_unit_id, notes. `geom` is set by a `BEFORE INSERT/UPDATE` trigger from lat/lon.

**`patrol_units`** — callsign (unique), station, phone, geom + GIST, status, last_seen.

**`incident_events`** — audit log. `authenticated` has read-only access; there is no UPDATE / DELETE policy for that role. Only the service_role (i.e. the API) can INSERT. **This is the tamper-evidence story for the defence.**

**`sms_inbox`** — raw record of every inbound SMS. `provider_id` is UNIQUE, so AT's HTTP retries automatically dedupe.

**RLS** is enabled on every table. Anonymous role has no read/write on any table — the reporter POSTs to a route handler which uses the service_role key server-side. Dispatchers get SELECT + UPDATE on `incidents` / `patrol_units` via the `authenticated` role.

**Realtime** publication is set for `incidents` and `patrol_units` so the console gets pushed updates.

---

## Security scoping

See `docs/security-scoping.md` for the full breakdown. Summary:

**Implemented and claimed:**

- TLS 1.2+ in transit on the data channel
- Supabase Auth with **TOTP MFA** — dispatcher routes require AAL2
- Row Level Security on every table; service_role never touches the browser
- Zod validation + Nigeria geographic bounds check
- Shared-secret webhook auth with `timingSafeEqual`
- Per-device (5/min) + per-IP (20/min) rate limits on `/api/report`
- Append-only `incident_events` (no UPDATE/DELETE policy for `authenticated`)

**Explicitly NOT claimed:**

- End-to-end encryption. The SMS leg crosses Africa's Talking in plaintext — that's a property of GSM, not a bug you can fix. Payload-level encryption is future work.
- Perfect GNSS accuracy.
- Horizontal-scale rate limiting (the limiter is per-process; swap for Upstash if you scale beyond one instance).

---

## Test matrix

See `docs/test-matrix.md`. Ten scenarios, each with an expected outcome and an evidence artefact. **Rows 3 and 5 are the two that carry the defence.**

| # | Scenario | Evidence |
| - | -------- | -------- |
| 1 | Report on full 4G | screenshot + row |
| 2 | Airplane mode | phone video |
| 3 | Connected with ~0 kbps throughput | DevTools capture |
| 4 | Inbound SMS via AT sandbox | webhook log + screenshot |
| 5 | Same `ref` via SMS then HTTPS → one row, both channels | SQL query before/after |
| 6 | Malformed SMS → logged, no incident, webhook returns 200 | `sms_inbox` row |
| 7 | Cold GPS fix, no data | timed video |
| 8 | 6 rapid reports one device → 429 after 5 | curl output |
| 9 | Login without TOTP → rejected | screenshot |
| 10 | Nearest-unit query ordering | RPC output |

Rows 4, 5, 6, 10 are already automated via curl in the setup transcript. Rows 1, 2, 3, 7, 8, 9 need a browser or phone.

Unit tests: `pnpm test` → 27 passing (20 parser + 7 dedup contract).

---

## Deployment

### Vercel (recommended)

```bash
pnpm i -g vercel
vercel
```

Set the same five env vars in Vercel → Project → Settings → Environment Variables. Point your AT callback URL at `https://<vercel-domain>/api/sms-webhook?k=<secret>` — no cloudflared needed.

**HTTPS is mandatory.** The Geolocation API refuses insecure origins, so there is no plain-HTTP demo.

### Any other host

Requirements: Node 20+ runtime, environment variables set as above, `pnpm build && pnpm start`, HTTPS.

---

## Known deviations from the proposal

1. **Silent SMS on failover isn't possible.** No browser API. We use `sms:` URI + user tap. Frame this as *user-confirmed SMS dispatch* — an anti-hoax control, not a limitation.
2. **Stack.** Proposal §1.4(b) specified PHP + MySQL. We use Next.js + Postgres+PostGIS. Justification for the report: PostGIS gives spheroid-accurate spatial querying (MySQL's spatial extensions are planar), and push-based Realtime removes the dispatch-latency inherent to polling. Confirm with supervisor and amend §1.4(b)–(c).
3. **Reporter route.** Spec calls for `app/(report)/page.tsx` (route group → URL `/`). We use `/report` and put a marketing landing at `/`. Adjust to preference.

---

## Not in scope

- **Outbound driver alerting** (proposal §1.2 mentions warning "nearby road users"). Objectives (a)–(d) do not include it. This is proactively named as **future work** in Chapter 5.
- **Payload encryption for the SMS channel.** Also future work — an agreed keypair between installs and the FRSC endpoint, with out-of-band rotation.
- **Escalation policies.** Status transitions are manual in the console; auto-escalation is out of scope.

---

## Contributing / repo conventions

- **Conventional Commits** — `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `chore: ...`, `style(scope): ...`
- Commit messages explain the *why*, not the *what* the diff already shows.
- No emojis in code or commits unless the user asks.
- Prefer editing existing files to creating new ones.
- Never add coauthors to commit messages.

## License

TBD.
