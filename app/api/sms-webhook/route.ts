import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { parsePayload, PayloadError } from '@/lib/sms-payload';

// Needs node runtime for crypto.timingSafeEqual.
export const runtime = 'nodejs';

function checkSecret(req: Request): boolean {
  const url = new URL(req.url);
  const provided = url.searchParams.get('k') ?? '';
  const expected = env.atWebhookSecret();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normPhone(s: string): string {
  const t = s.trim();
  if (t.startsWith('+')) return t;
  if (t.startsWith('0') && t.length === 11) return `+234${t.slice(1)}`;
  return t;
}

// Always return 200. Africa's Talking retries on non-200 and we get duplicates.
export async function POST(req: Request) {
  if (!checkSecret(req)) {
    // Silent 200 — we don't leak whether the secret exists.
    return new NextResponse('ok', { status: 200 });
  }

  const contentType = req.headers.get('content-type') ?? '';
  let from = '';
  let text = '';
  let providerId = '';
  let receivedAt = new Date().toISOString();

  try {
    if (contentType.includes('application/json')) {
      const j = (await req.json()) as Record<string, unknown>;
      from = String(j.from ?? '');
      text = String(j.text ?? '');
      providerId = String(j.id ?? '');
      if (j.date) receivedAt = new Date(String(j.date)).toISOString();
    } else {
      const form = await req.formData();
      from = String(form.get('from') ?? '');
      text = String(form.get('text') ?? '');
      providerId = String(form.get('id') ?? '');
      const d = form.get('date');
      if (d) receivedAt = new Date(String(d)).toISOString();
    }
  } catch {
    return new NextResponse('ok', { status: 200 });
  }

  if (!providerId || !from || !text) {
    return new NextResponse('ok', { status: 200 });
  }

  const sb = supabaseAdmin();

  // Step 1: log every inbound SMS raw. provider_id unique also kills AT retry
  // duplicates for free (see CLAUDE.md §3).
  const { data: inboxRow, error: inboxErr } = await sb
    .from('sms_inbox')
    .insert({
      provider_id: providerId,
      from_msisdn: from,
      text,
      received_at: receivedAt,
      parse_status: 'pending',
    })
    .select('id')
    .single();

  if (inboxErr) {
    // Duplicate provider_id → retry; 23505 = unique_violation.
    if ((inboxErr as { code?: string }).code === '23505') {
      return new NextResponse('ok', { status: 200 });
    }
    return new NextResponse('ok', { status: 200 });
  }

  // Step 2: parse.
  let parsed;
  try {
    parsed = parsePayload(text);
  } catch (e) {
    const code = e instanceof PayloadError ? e.code : 'unknown';
    await sb
      .from('sms_inbox')
      .update({ parse_status: 'malformed', error_code: code })
      .eq('id', inboxRow.id);
    return new NextResponse('ok', { status: 200 });
  }

  // Step 3: upsert incident.
  const phone = parsed.reporter_phone ? normPhone(parsed.reporter_phone) : normPhone(from);
  const { data: upsertRow, error: upErr } = await sb.rpc('upsert_incident', {
    p_ref: parsed.ref,
    p_lat: parsed.lat,
    p_lon: parsed.lon,
    p_accuracy_m: parsed.accuracy_m,
    p_incident_type: parsed.incident_type,
    p_severity: parsed.severity,
    p_reporter_phone: phone,
    p_device_id: null,
    p_channel: 'sms',
    p_client_ts: receivedAt,
    p_notes: null,
  });

  if (upErr) {
    await sb
      .from('sms_inbox')
      .update({ parse_status: 'db_error', error_code: upErr.message })
      .eq('id', inboxRow.id);
    return new NextResponse('ok', { status: 200 });
  }

  const row = Array.isArray(upsertRow) ? upsertRow[0] : upsertRow;
  await sb
    .from('sms_inbox')
    .update({ parse_status: row?.created ? 'created' : 'merged', incident_id: row?.id })
    .eq('id', inboxRow.id);

  if (row?.id) {
    await sb.from('incident_events').insert({
      incident_id: row.id,
      actor: 'system:sms-webhook',
      action: row.created ? 'created' : 'merged',
      meta: { channel: 'sms', from_msisdn: from, provider_id: providerId },
    });
  }

  return new NextResponse('ok', { status: 200 });
}
