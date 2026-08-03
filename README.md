# GERAS

Hybrid Dual-Channel Geospatial Emergency Alert System for the FRSC.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v3 · Supabase (Postgres + PostGIS + Auth + Realtime) · Leaflet · Africa's Talking.

See `CLAUDE.md` for the full build spec.

## Setup

```bash
pnpm install
cp .env.example .env.local        # fill in Supabase + AT creds
pnpm test                          # unit tests (parser, dedup logic)
pnpm dev                           # http://localhost:3000
```

## Supabase

Apply migrations against a project with the PostGIS extension available:

```bash
psql "$DATABASE_URL" -f supabase/migrations/001_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/002_seed.sql
psql "$DATABASE_URL" -f supabase/migrations/003_nearest_units.sql
```

## Layout

- `app/report/` — road-user PWA reporter (no auth)
- `app/console/` — dispatcher console (Supabase Auth + TOTP MFA)
- `app/login/` — password + TOTP challenge (enrol on first login)
- `app/api/` — route handlers (report, sms-webhook, incidents, units, health)
- `components/reporter/` — TypeGrid, SeverityDial, SendButton, ChannelStrip, SmsHandoff
- `components/console/` — ConsoleShell, IncidentList, IncidentMap, IncidentDrawer, UnitPanel
- `lib/sms-payload.ts` — shared payload builder/parser, single source of truth
- `lib/failover.ts` — channel decision + `sms:` handoff
- `lib/geo.ts` / `lib/net.ts` / `lib/outbox.ts` — GPS cache, health probe, IDB queue
- `lib/supabase/{client,server,admin}.ts` — browser / SSR / service-role clients
- `public/sw.js` — service worker (shell precache, NetworkOnly for `/api/*`)
- `supabase/migrations/` — PostGIS schema + seed + nearest_units RPC
- `docs/test-matrix.md` — Chapter 4 evidence
- `docs/security-scoping.md` — Chapter 4 / Chapter 5 honest claims table

## Africa's Talking sandbox

The AT sandbox simulator posts inbound SMS to `/api/sms-webhook?k=<secret>`
for free. Point it at your dev URL, set the same secret in `.env.local`
(`AT_WEBHOOK_SECRET`). Production shortcodes are paid and take days to
provision — the production path is noted in Chapter 4 but not required
for the defence.

## The one deviation from the proposal

The PWA cannot send SMS silently — no browser API for it. On failover we build an
`sms:` URI pre-filled with the payload and hand off to the native messaging app.
The user taps Send. This is the **user-confirmed SMS dispatch** control that
doubles as the anti-hoax gate.
