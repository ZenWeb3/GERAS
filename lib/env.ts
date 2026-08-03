// Env accessors. In production a missing var throws at first use so nothing
// silently falls back to a default. During `next build` (no NODE_ENV=production
// runtime yet), we return placeholders so static generation of client pages
// that construct a Supabase browser client at render time can complete —
// those pages only fetch data client-side, where NEXT_PUBLIC_* are set.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

function required(name: string, val: string | undefined, placeholder = ''): string {
  if (val) return val;
  if (isBuild) return placeholder;
  throw new Error(`Missing env: ${name}`);
}

export const env = {
  supabaseUrl: () =>
    required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL, 'https://placeholder.supabase.co'),
  supabaseAnonKey: () =>
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'placeholder-anon-key'),
  supabaseServiceKey: () =>
    required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY, 'placeholder-service-key'),
  atWebhookSecret: () =>
    required('AT_WEBHOOK_SECRET', process.env.AT_WEBHOOK_SECRET, 'placeholder-webhook-secret'),
  smsShortcode: () =>
    process.env.NEXT_PUBLIC_SMS_SHORTCODE ?? '',
};
