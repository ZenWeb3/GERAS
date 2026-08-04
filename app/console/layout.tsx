import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/login');

  return (
    <div className="h-[100dvh] flex flex-col bg-white overflow-hidden">
      <header className="h-14 shrink-0 border-b border-line flex items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-ink text-white grid place-items-center font-bold text-sm">G</div>
          <div>
            <div className="font-semibold tracking-tight leading-none">GERAS</div>
            <div className="text-[10px] uppercase tracking-wider text-muted leading-none mt-0.5">
              Dispatch
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-subink">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live
          </span>
          <span className="text-sm text-subink">{user.email}</span>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
