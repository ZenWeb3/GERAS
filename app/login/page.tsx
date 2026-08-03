'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type Stage = 'password' | 'totp' | 'enrol';

export default function LoginPage() {
  const router = useRouter();
  const sb = createSupabaseBrowser();
  const [stage, setStage] = useState<Stage>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [enrolQr, setEnrolQr] = useState<string | null>(null);
  const [enrolSecret, setEnrolSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: factors, error: fErr } = await sb.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const totp = factors?.totp?.find((f) => f.status === 'verified');
      if (totp) {
        const { data: ch, error: cErr } = await sb.auth.mfa.challenge({ factorId: totp.id });
        if (cErr) throw cErr;
        setFactorId(totp.id);
        setChallengeId(ch.id);
        setStage('totp');
        return;
      }
      const { data: enr, error: enrErr } = await sb.auth.mfa.enroll({ factorType: 'totp' });
      if (enrErr) throw enrErr;
      setFactorId(enr.id);
      setEnrolQr(enr.totp.qr_code);
      setEnrolSecret(enr.totp.secret);
      setStage('enrol');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setErr(null);
    setBusy(true);
    try {
      let ch = challengeId;
      if (!ch) {
        const { data, error } = await sb.auth.mfa.challenge({ factorId });
        if (error) throw error;
        ch = data.id;
        setChallengeId(ch);
      }
      const { error } = await sb.auth.mfa.verify({ factorId, challengeId: ch, code });
      if (error) throw error;
      router.replace('/console');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dispatcher sign-in</h1>
          <p className="text-muted text-sm mt-1">Second factor required.</p>
        </div>

        {stage === 'password' && (
          <form onSubmit={signIn} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="username"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-surface border border-line px-3 py-2"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-surface border border-line px-3 py-2"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-teal/90 hover:bg-teal text-black font-medium py-2 disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Continue'}
            </button>
          </form>
        )}

        {stage === 'enrol' && enrolQr && (
          <div className="space-y-3">
            <p className="text-sm">
              Scan this QR with your authenticator app, then enter the 6-digit code.
            </p>
            <div className="bg-white rounded-lg p-3 flex justify-center">
              {/* Supabase returns an SVG data URL */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrolQr} alt="TOTP QR" width={192} height={192} />
            </div>
            <p className="text-xs text-muted font-mono break-all">Secret: {enrolSecret}</p>
            <form onSubmit={verifyTotp} className="space-y-3">
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg bg-surface border border-line px-3 py-2 tracking-widest text-center font-mono"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-teal/90 hover:bg-teal text-black font-medium py-2 disabled:opacity-50"
              >
                {busy ? 'Verifying…' : 'Verify & enable'}
              </button>
            </form>
          </div>
        )}

        {stage === 'totp' && (
          <form onSubmit={verifyTotp} className="space-y-3">
            <p className="text-sm text-muted">Enter the code from your authenticator.</p>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="123456"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg bg-surface border border-line px-3 py-2 tracking-widest text-center font-mono"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-teal/90 hover:bg-teal text-black font-medium py-2 disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
          </form>
        )}

        {err && <p className="text-critical text-sm">{err}</p>}
      </div>
    </main>
  );
}
