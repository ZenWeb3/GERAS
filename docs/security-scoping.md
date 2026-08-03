# GERAS — Honest Security Scoping

Per CLAUDE.md §9. **What is claimed and implemented, and what is explicitly not.**

## Claimed and implemented

| Control                                            | Implementation                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| TLS 1.2+ in transit on the data channel            | Vercel / Supabase both terminate TLS; no plain-HTTP origin (Geolocation API refuses insecure origins anyway) |
| Supabase Auth with TOTP MFA for dispatchers        | `app/login/page.tsx` enrols on first login, `app/console/layout.tsx` gates on `aal2` |
| Row-Level Security on every table                  | `001_schema.sql` — anonymous role has no read/write on any table; service-role used server-side only |
| Service-role key server-side only                  | `lib/supabase/admin.ts` — grep-friendly, imported only by route handlers        |
| Parameterised queries + Zod validation             | All route handlers Zod-validate; `upsert_incident` is a PL/pgSQL function      |
| Geographic bounds check                            | `lib/sms-payload.ts` rejects lat/lon outside Nigeria (4–14, 2–15)              |
| Shared-secret webhook auth with `timingSafeEqual`  | `app/api/sms-webhook/route.ts` — constant-time compare; silent 200 on mismatch |
| Per-device + per-IP rate limits on `/api/report`   | `lib/rate-limit.ts` — 5/min per `device_id`, 20/min per IP (hoax-injection control) |
| Append-only `incident_events` (tamper evidence)    | Table has no UPDATE / DELETE RLS policy for `authenticated`; only service-role writes |

## Explicitly NOT claimed

- **End-to-end encryption.** The SMS leg crosses Africa's Talking in plaintext.
  That is a property of GSM, not a bug this system can fix.
- **Perfect location.** GNSS accuracy is what the device reports. The reporter
  flags stale fixes (>30s) so the dispatcher sees the caveat.
- **Cross-region infrastructure.** Rate limiting is per-process in-memory;
  horizontal scale requires an external store (Upstash / Redis).
- **Silent SMS from the browser.** No web API exists. The reporter builds an
  `sms:` URI and hands off to the OS messaging app — described as
  *user-confirmed SMS dispatch*, which doubles as the anti-hoax gate.

## Future work

- Payload-level encryption for the SMS channel (agreed keypair between the
  reporter install and the FRSC endpoint, out-of-band key rotation).
- Outbound driver alerting (§1.2 mention; not in objectives).
- Escalation policies (currently a manual status transition in the console).
