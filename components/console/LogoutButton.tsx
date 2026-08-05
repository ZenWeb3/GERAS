'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      const sb = createSupabaseBrowser();
      await sb.auth.signOut({ scope: 'local' });
      router.replace('/login');
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-soft hover:bg-line text-ink transition disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
