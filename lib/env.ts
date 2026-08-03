function required(name: string, val: string | undefined): string {
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

export const env = {
  supabaseUrl: () =>
    required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceKey: () =>
    required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  atWebhookSecret: () =>
    required('AT_WEBHOOK_SECRET', process.env.AT_WEBHOOK_SECRET),
  smsShortcode: () =>
    process.env.NEXT_PUBLIC_SMS_SHORTCODE ?? '',
};
