'use client';

import { useEffect, useState } from 'react';
import TypeGrid from '@/components/reporter/TypeGrid';
import SeverityDial from '@/components/reporter/SeverityDial';
import SendButton from '@/components/reporter/SendButton';
import ChannelStrip from '@/components/reporter/ChannelStrip';
import SmsHandoff from '@/components/reporter/SmsHandoff';
import { getCached, startWatching } from '@/lib/geo';
import { probeOnline } from '@/lib/net';
import { reconcile, submit, type SubmitOutcome } from '@/lib/failover';
import type { IncidentType, Severity } from '@/lib/types';

const SHORTCODE = process.env.NEXT_PUBLIC_SMS_SHORTCODE ?? '15629';

export default function ReporterPage() {
  const [type, setType] = useState<IncidentType | null>(null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    startWatching();
    const t = setInterval(() => {
      const c = getCached();
      if (c) {
        setAcc(c.accuracy_m);
        setStale(Date.now() - c.timestamp > 30_000);
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ok = await probeOnline();
      if (!cancelled) setOnline(ok);
    };
    check();
    const t = setInterval(check, 15_000);
    const onOnline = () => {
      check();
      reconcile().then(({ resent }) => {
        if (resent > 0) setNote(`Re-sent ${resent} queued report${resent > 1 ? 's' : ''}.`);
      });
    };
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const send = async () => {
    if (!type || !severity) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await submit({ incident_type: type, severity }, SHORTCODE);
      setOutcome(res);
      if (res.kind === 'sms_handoff') window.location.href = res.sms_uri;
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setOutcome(null);
    setType(null);
    setSeverity(null);
    setNote(null);
  };

  const ready = type !== null && severity !== null && !busy;

  if (outcome?.kind === 'sms_handoff') {
    return (
      <SmsHandoff
        ref={outcome.ref}
        payload={outcome.payload}
        smsUri={outcome.sms_uri}
        onReset={reset}
      />
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-white text-ink">
      <ChannelStrip online={online} accuracy_m={acc} stale={stale} />

      <div className="flex-1 px-5 pt-5 pb-3 space-y-7 overflow-y-auto max-w-lg w-full mx-auto">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Report an incident</h1>
          <p className="text-subink text-base mt-1.5">
            No account needed. Location is captured automatically.
          </p>
        </div>

        <section aria-labelledby="type-h">
          <h2 id="type-h" className="text-xs uppercase tracking-wider text-muted mb-2 font-semibold">Type</h2>
          <TypeGrid value={type} onChange={setType} />
        </section>

        <section aria-labelledby="sev-h">
          <h2 id="sev-h" className="text-xs uppercase tracking-wider text-muted mb-2 font-semibold">Severity</h2>
          <SeverityDial value={severity} onChange={setSeverity} />
        </section>

        {outcome?.kind === 'sent_https' && (
          <div className="rounded-2xl bg-success/10 border border-success/30 p-4">
            <div className="text-success text-xs uppercase tracking-wider font-semibold">Sent · Data</div>
            <div className="font-mono text-2xl font-bold mt-1 tracking-wider">{outcome.ref}</div>
            <div className="text-xs text-muted mt-0.5">
              ±{outcome.accuracy_m} m{outcome.stale_fix && ' (using last known location)'}
            </div>
            <button onClick={reset} className="text-sm underline mt-3 text-subink">
              Report another
            </button>
          </div>
        )}

        {outcome?.kind === 'error' && (
          <div className="rounded-2xl bg-accent/10 border border-accent/30 p-4">
            <div className="text-accent text-xs uppercase tracking-wider font-semibold">Error</div>
            <div className="text-sm mt-1">{outcome.message}</div>
          </div>
        )}

        {note && (
          <div className="rounded-2xl bg-soft p-3 text-sm">{note}</div>
        )}
      </div>

      <div className="p-5 pt-3 sticky bottom-0 bg-white/95 backdrop-blur border-t border-line max-w-lg w-full mx-auto">
        <SendButton ready={ready} busy={busy} onClick={send} />
      </div>
    </main>
  );
}
