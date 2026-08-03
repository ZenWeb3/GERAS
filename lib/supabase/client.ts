'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '../env';

export function createSupabaseBrowser() {
  return createBrowserClient(env.supabaseUrl(), env.supabaseAnonKey());
}
