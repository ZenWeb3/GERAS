import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const FiltersSchema = z.object({
  status: z.string().optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export async function GET(req: Request) {
  const sb = await createSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const filters = FiltersSchema.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    since: url.searchParams.get('since') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!filters.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }
  const { status, since, limit = 100 } = filters.data;

  let q = sb
    .from('incidents')
    .select(
      'id, ref, lat, lon, accuracy_m, incident_type, severity, reporter_phone, channel_first, channels_seen, client_ts, server_ts, status, assigned_unit_id, notes',
    )
    .order('server_ts', { ascending: false })
    .limit(limit);

  if (status) q = q.eq('status', status);
  if (since) q = q.gte('server_ts', since);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ incidents: data ?? [] });
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'triaged', 'dispatched', 'onscene', 'resolved', 'cancelled']).optional(),
  assigned_unit_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(req: Request) {
  const sb = await createSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }
  const { id, ...changes } = parsed.data;
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 });
  }

  // Update via authenticated client so RLS applies. Audit via service role so
  // the append-only tamper trail cannot be bypassed by a client with no insert
  // policy on incident_events.
  const { error: updErr } = await sb.from('incidents').update(changes).eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabaseAdmin().from('incident_events').insert({
    incident_id: id,
    actor: `user:${user.id}`,
    action: 'patch',
    meta: changes,
  });

  return NextResponse.json({ ok: true });
}
