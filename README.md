<div align="center">

# GERAS

**Dual-channel emergency alerting for road safety agencies.**

*One tap on the roadside. A live incident on the dispatcher's map — over data, or over SMS when there's no signal.*

</div>

---

## Overview

GERAS is a production-ready emergency alerting platform built for road safety and first-response agencies operating in low-connectivity regions. Road users report incidents from a lightweight PWA — no app install, no account. Dispatchers coordinate response from a real-time console with live incident feeds, nearest-unit dispatching, and a tamper-evident audit trail.

The system is designed around a single hard problem: **the moment a road user needs help is exactly when the network is least likely to work**. GERAS treats mobile connectivity as three states — online, offline, and *online with zero throughput* — and provides an automatic SMS fallback that lands in the same operational pipeline as data alerts.

---

## Why GERAS

|                             |                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| **Reaches dispatch anyway** | Automatic failover to SMS when data fails. No lost alerts, no re-training users.           |
| **One incident per event**  | SMS and data reports for the same event merge server-side on a shared reference code.       |
| **No install friction**     | The reporter is a PWA. A URL and a tap. Works on any modern phone.                          |
| **Real-time coordination**  | Dispatchers see incidents pop in live, sorted by severity, with nearest patrols one click away. |
| **Tamper-evident**          | Every status change is appended to an audit log that authenticated users cannot rewrite.    |
| **Provably secure**         | TOTP MFA for dispatchers, RLS on every table, constant-time webhook auth, geographic input bounds. |

---

## Features

### For road users (the reporter)

- **Single-screen alert** — pick incident type, severity, tap Send. No accounts, no onboarding, no scroll.
- **Automatic channel selection** — probe → HTTPS if it works, SMS fallback if it doesn't. The user never has to choose.
- **GPS with graceful degradation** — cached fixes for instant sends, hard 8-second ceiling on cold locks, stale-fix warning in the UI.
- **Offline queue** — alerts persist in IndexedDB. Reconcile automatically when connectivity returns.
- **PWA-installable** — add to home screen, works with the radio off (from the offline shell).

### For dispatchers (the console)

- **Live incident feed** — Realtime push, pulsing markers, tab-title badge, audio ping.
- **Filterable list** — All / Open / Critical chips with counts.
- **Interactive map** — labelled streets, hover tooltips (type · severity · ref · location · status · time), one-click fit-to-all, keyboard + touch + scroll navigation.
- **Nearest-unit dispatch** — top 5 available patrols by geodesic distance, with ETA estimates.
- **Status workflow** — New → Triaged → Dispatched → On scene → Resolved. Every transition audited.
- **Optimistic updates** — dispatcher actions feel instant; server confirms in the background.

### Platform

- **Dual-channel ingest** with atomic server-side dedup on a shared reference code
- **PostGIS-backed geospatial querying** — spheroid-accurate distances, GIST-indexed nearest-neighbour lookups
- **Rate-limited public endpoints** — 5/min per device, 20/min per IP on the report endpoint
- **Constant-time webhook authentication** for the SMS provider
- **Append-only audit trail** on incident state changes
- **Row-Level Security** on every table; service-role key isolated to server-only code paths

---

## How it works

```
                      ┌──────────────────────────────┐
                      │   Road user's phone browser  │
                      │  (PWA at /report — no login) │
                      └──────────────┬───────────────┘
                                     │
                        [ tap Send ] │
                                     ▼
                         ┌────────────────────────┐
                         │ probe /api/health 3.5s │
                         └──────┬────────┬────────┘
                    probe OK    │        │  probe fails
                                ▼        ▼
                   ┌─────────────────┐  ┌────────────────────┐
                   │ POST /api/report│  │ open sms: URI with │
                   │ (HTTPS)         │  │ payload prefilled  │
                   └────────┬────────┘  └─────────┬──────────┘
                            │                     │
                            ▼                     ▼
                      ┌───────────────────────────────┐
                      │ upsert_incident() on ref      │
                      │ ─ first arrival wins channel  │
                      │ ─ later arrivals enrich       │
                      │ ─ channels_seen tracks both   │
                      └──────────────┬────────────────┘
                                     ▼
                      ┌────────────────────────────┐
                      │ Postgres INSERT/UPDATE     │
                      │ + Realtime push            │
                      │ + append-only audit event  │
                      └──────────────┬─────────────┘
                                     ▼
                      ┌────────────────────────────┐
                      │ Dispatcher console         │
                      │ /console (auth + TOTP)     │
                      │ live map · list · drawer   │
                      └────────────────────────────┘
```

The SMS provider (Africa's Talking, or any provider that POSTs form-urlencoded incoming messages) hits `/api/sms-webhook` — same upsert function, same merge semantics. A road user who sends **both** a data report and an SMS for the same incident produces exactly **one** row.

---

## The SMS payload

Human-typable if needed, keyword-first for shared-shortcode routing, fits one GSM-7 segment:

```
GERAS <ref> <lat> <lon> <acc> <type> <sev> [phone]
```

| Field   | Constraint |
| ------- | ---------- |
| `ref`   | 6 chars, Crockford base32 (`0-9A-HJKMNP-TV-Z`) — the dedup key |
| `lat`   | 5 decimal places (≈1.1 m), signed |
| `lon`   | 5 decimal places, signed |
| `acc`   | GPS accuracy in metres, integer, clamped ≤9999 |
| `type`  | `ACC` crash · `MED` medical · `FIR` fire · `BRK` breakdown · `OBS` obstruction |
| `sev`   | `1` minor · `2` serious · `3` critical |
| `phone` | Optional callback, 10–14 digits, leading `+` optional |

Example (44 chars, well inside 160):

```
GERAS A3F2K9 4.90570 7.85370 12 ACC 2 08031234567
```

Parser and builder share one implementation in `lib/sms-payload.ts` and are covered by 20 unit tests. Geographic bounds are validated at parse time; anything outside the operating region is logged as `malformed` and rejected.

---

## Stack

| Layer      | Choice |
| ---------- | ------ |
| Framework  | Next.js 15 (App Router) |
| Language   | TypeScript |
| Styling    | Tailwind CSS |
| Database   | PostgreSQL + PostGIS |
| Backend    | Supabase (Postgres, Auth, Realtime, Storage) |
| Auth       | Email + password with TOTP MFA (AAL2 gated) |
| Maps       | Leaflet + OpenStreetMap |
| Offline    | Service worker + IndexedDB |
| SMS        | Africa's Talking (adaptable to any HTTP-webhook SMS gateway) |
| Deployment | Vercel (or any Node 20+ host) |

---

## Getting started

### Prerequisites

- Node 20+
- pnpm 9+ (`npm i -g pnpm`)
- A Supabase project ([supabase.com](https://supabase.com) — free tier is fine)
- An Africa's Talking account for SMS ([africastalking.com](https://africastalking.com) — sandbox is free)

### 1. Install

```bash
git clone https://github.com/ZenWeb3/GERAS.git
cd GERAS
pnpm install
```

### 2. Configure

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=          # Supabase → Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase → Settings → API → anon public
SUPABASE_SERVICE_ROLE_KEY=         # Supabase → Settings → API → service_role secret
AT_WEBHOOK_SECRET=                 # openssl rand -hex 32
NEXT_PUBLIC_SMS_SHORTCODE=15629    # your reserved shortcode (or an AT sandbox one)
```

### 3. Provision the database

In Supabase → SQL Editor, run these migrations **in order**:

1. `supabase/migrations/001_schema.sql` — schema, RLS, indexes, upsert function
2. `supabase/migrations/002_seed.sql` — 6 patrol units + 8 sample incidents
3. `supabase/migrations/003_nearest_units.sql` — nearest-neighbour RPC
4. `supabase/migrations/005_upsert_pragma.sql` — dedup function hardening

### 4. Create a dispatcher account

```bash
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d '{"email":"dispatcher@example.com","password":"ChangeMe!2026","email_confirm":true}'
```

Or use Supabase dashboard → Authentication → Add user → Auto-confirm email.

### 5. Run

```bash
pnpm dev
```

Open **http://localhost:3000**.

- Reporter: `/report`
- Dispatcher: `/login` → land on `/console` after TOTP challenge

---

## Testing on a real device

The reporter needs HTTPS for browser GPS and service worker registration. On `localhost` you're fine — on any other origin you need TLS.

### Cloudflared quick tunnel

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the printed `https://*.trycloudflare.com` URL and open it on your phone.

### Africa's Talking wiring

1. Reserve a shortcode: **AT dashboard → SMS → Shortcodes** (sandbox codes are free and instant).
2. Set the callback: **SMS → Callback URLs → Incoming Messages** →
   ```
   https://<your-domain>/api/sms-webhook?k=<your AT_WEBHOOK_SECRET>
   ```
3. Send a test from **Tools → Launch Simulator**:
   ```
   GERAS X9Y8Z7 5.03780 7.93370 15 FIR 3 08039998888
   ```

Watch `/console` — the incident appears in real time.

---

## API reference

### `GET /api/health`

Health probe used by the reporter to distinguish real connectivity from zero-throughput states. Edge runtime, no database call, `cache-control: no-store`.

### `POST /api/report`

Public HTTPS ingest. Rate-limited per device (5/min) and per IP (20/min).

```json
POST /api/report
Content-Type: application/json

{
  "ref": "A3F2K9",
  "lat": 4.90570, "lon": 7.85370, "accuracy_m": 12,
  "incident_type": "ACC", "severity": 2,
  "reporter_phone": "+2348031234567",
  "device_id": "uuid-v4",
  "client_ts": "2026-08-05T12:00:00Z"
}

→ 201 { "status": "created", "id": "...", "ref": "A3F2K9" }
→ 200 { "status": "merged",  "id": "...", "ref": "A3F2K9" }
→ 429 { "error": "rate_limited", "retry_after_s": 42 }
```

### `POST /api/sms-webhook`

SMS gateway ingest. Accepts JSON or `application/x-www-form-urlencoded`. Shared-secret authentication via `?k=`, compared in constant time. **Always returns 200** to prevent retry storms — parse failures are recorded in `sms_inbox` for later review.

### `GET /api/incidents`

Session-authenticated. Query params: `status`, `since`, `limit`. Used for initial console load and Realtime-drop recovery.

### `PATCH /api/incidents`

Session-authenticated. Updates status, unit assignment, or notes. Every mutation appends an audit row to `incident_events` through a service-role client, so the audit log cannot be bypassed by an RLS-restricted user.

### `GET /api/units?lat=&lon=`

Session-authenticated. Returns the nearest available patrol units by geodesic distance, with ETA estimates.

---

## Security

**Implemented:**

- TLS 1.2+ enforced on the data channel
- TOTP MFA required for all dispatcher access (AAL2 assurance level)
- Row-Level Security on every table
- Service-role key confined to server-only imports
- Zod validation with geographic bounds checking on all public inputs
- Constant-time secret comparison on the SMS webhook
- Per-device + per-IP sliding-window rate limiting
- Append-only audit log on incident state changes
- Parameterised queries throughout

**Not claimed:**

- End-to-end encryption of the SMS channel. GSM is plaintext in transit; payload-level encryption is a roadmap item requiring an out-of-band key agreement with the receiving endpoint.

Full security posture in [`docs/security-scoping.md`](docs/security-scoping.md).

---

## Deployment

### Vercel

```bash
pnpm i -g vercel
vercel
```

Add the five environment variables in Project → Settings → Environment Variables. Point your SMS gateway callback at `https://<vercel-domain>/api/sms-webhook?k=<secret>`.

### Any Node host

Requirements: Node 20+, HTTPS termination, environment variables. Build once, then serve:

```bash
pnpm build
pnpm start
```

### Data layer

Supabase is the fastest path (Postgres + Auth + Realtime bundled). Self-hosting is possible with any Postgres 15+ with the PostGIS extension, a REST layer such as PostgREST, and a WebSocket source for Realtime updates.

---

## Development

```bash
pnpm dev         # dev server with HMR
pnpm test        # unit test suite (27 tests)
pnpm typecheck   # strict TypeScript
pnpm build       # production build
pnpm start       # serve the build
```

### Tests

- `tests/sms-payload.test.ts` — 20 tests covering the SMS payload parser and builder: canonical example, optional phone, GSM-7 length, Crockford alphabet rules, keyword rejection, geographic bounds, full build→parse round-trip.
- `tests/dedup.test.ts` — 7 tests mirroring the SQL upsert merge rules in-process, so the dedup contract can be verified without a live database.

### Repo layout

```
app/               Next.js routes (App Router)
  api/             route handlers
  console/         dispatcher UI
  login/           auth flow
  report/          reporter PWA
components/        React components (reporter/*, console/*)
lib/               shared logic
  sms-payload.ts   parser + builder (shared client & server)
  failover.ts      channel decision + SMS handoff + reconcile
  geo.ts           GPS watch + cache + timeout
  net.ts           connectivity probe
  outbox.ts        IndexedDB queue
  supabase/        browser / SSR / admin clients
public/            static assets + service worker + PWA manifest
supabase/          SQL migrations
tests/             unit tests (vitest)
docs/              architecture and security notes
```

### Conventions

- **Conventional Commits** — `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `chore: ...`, `style(scope): ...`
- Commits explain the *why*; the diff already shows the *what*
- Prefer editing existing files to creating new ones
- Strict TypeScript, no `any`, no unused variables

---

## Roadmap

- **Outbound driver alerts** — proactively notify drivers approaching an active incident zone
- **Payload-level SMS encryption** — agreed keypair between installs and the receiving endpoint, with out-of-band rotation
- **Multi-region deployment** — Postgres logical replication for cross-region incident visibility
- **Escalation policies** — automatic status transitions based on unit acknowledgement timers
- **Native mobile companion** — thin wrapper around the reporter, opting into Push notifications and background geolocation
- **Fleet integration** — REST/webhook adapters for third-party dispatch systems

---

## License

Proprietary. All rights reserved. Contact the maintainer for licensing enquiries.
