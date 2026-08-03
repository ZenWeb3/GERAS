import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NG_BOUNDS } from '@/lib/sms-payload';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  lat: z.coerce.number().gte(NG_BOUNDS.latMin).lte(NG_BOUNDS.latMax),
  lon: z.coerce.number().gte(NG_BOUNDS.lonMin).lte(NG_BOUNDS.lonMax),
  limit: z.coerce.number().int().positive().max(20).optional().default(5),
});

export async function GET(req: Request) {
  const sb = await createSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    lat: url.searchParams.get('lat'),
    lon: url.searchParams.get('lon'),
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }
  const { lat, lon, limit } = parsed.data;

  // Nearest-unit query uses the GIST <-> operator. ETA at 60 km/h.
  const { data, error } = await supabaseAdmin().rpc('nearest_units', {
    p_lat: lat,
    p_lon: lon,
    p_limit: limit,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const units = (data ?? []).map((u: { km: number } & Record<string, unknown>) => ({
    ...u,
    eta_min: Math.round((u.km / 60) * 60),
  }));

  return NextResponse.json({ units });
}
