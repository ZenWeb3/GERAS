import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';

// Service-role client — MUST NEVER be imported by client components. Kept in
// this file so it's easy to grep and audit. Route handlers only.
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-geras-role': 'service' } },
  });
  return cached;
}
