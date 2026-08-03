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
```

## Layout

- `app/(report)/` — road-user PWA reporter (no auth)
- `app/console/` — dispatcher console (Supabase Auth + TOTP MFA)
- `app/api/` — route handlers (report, sms-webhook, incidents, units, health)
- `lib/sms-payload.ts` — shared payload builder/parser, single source of truth
- `lib/failover.ts` — channel decision + `sms:` handoff
- `supabase/migrations/` — PostGIS schema + seed data
- `docs/test-matrix.md` — Chapter 4 evidence

## The one deviation from the proposal

The PWA cannot send SMS silently — no browser API for it. On failover we build an
`sms:` URI pre-filled with the payload and hand off to the native messaging app.
The user taps Send. This is the **user-confirmed SMS dispatch** control that
doubles as the anti-hoax gate.
