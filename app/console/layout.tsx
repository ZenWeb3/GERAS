import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  // AAL2 = MFA-satisfied session. Below that, force a challenge.
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/login');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-12 border-b border-line flex items-center justify-between px-4 bg-surface/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-teal font-semibold tracking-tight">GERAS</span>
          <span className="text-muted text-xs uppercase tracking-wider">Dispatch console</span>
        </div>
        <div className="text-xs text-muted">{user.email}</div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
