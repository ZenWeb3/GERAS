import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { NG_BOUNDS } from '@/lib/sms-payload';

export const runtime = 'nodejs';

const ReportSchema = z.object({
  ref: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{6}$/i),
  lat: z.number().gte(NG_BOUNDS.latMin).lte(NG_BOUNDS.latMax),
  lon: z.number().gte(NG_BOUNDS.lonMin).lte(NG_BOUNDS.lonMax),
  accuracy_m: z.number().int().nonnegative().max(9999).default(9999),
  incident_type: z.enum(['ACC', 'MED', 'FIR', 'BRK', 'OBS']),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reporter_phone: z
    .string()
    .regex(/^\+?\d{10,14}$/)
    .optional()
    .nullable(),
  device_id: z.string().uuid().optional().nullable(),
  client_ts: z.string().datetime().optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;

  // Rate limits — hoax-injection control per CLAUDE.md §4.
  const ipKey = `report:ip:${clientIp(req)}`;
  const ipLimit = rateLimit(ipKey, 20, 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'rate_limited', scope: 'ip', retry_after_s: ipLimit.retry_after_s },
      { status: 429, headers: { 'retry-after': String(ipLimit.retry_after_s) } },
    );
  }
  if (p.device_id) {
    const devKey = `report:dev:${p.device_id}`;
    const devLimit = rateLimit(devKey, 5, 60_000);
    if (!devLimit.ok) {
      return NextResponse.json(
        { error: 'rate_limited', scope: 'device', retry_after_s: devLimit.retry_after_s },
        { status: 429, headers: { 'retry-after': String(devLimit.retry_after_s) } },
      );
    }
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc('upsert_incident', {
    p_ref: p.ref.toUpperCase(),
    p_lat: p.lat,
    p_lon: p.lon,
    p_accuracy_m: p.accuracy_m,
    p_incident_type: p.incident_type,
    p_severity: p.severity,
    p_reporter_phone: p.reporter_phone ?? null,
    p_device_id: p.device_id ?? null,
    p_channel: 'https',
    p_client_ts: p.client_ts ?? new Date().toISOString(),
    p_notes: p.notes ?? null,
  });

  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json({ error: 'no_row_returned' }, { status: 500 });
  }

  await sb.from('incident_events').insert({
    incident_id: row.id,
    actor: 'system:report',
    action: row.created ? 'created' : 'merged',
    meta: { channel: 'https', ip: clientIp(req) },
  });

  return NextResponse.json(
    { status: row.created ? 'created' : 'merged', id: row.id, ref: row.ref },
    { status: row.created ? 201 : 200 },
  );
}
