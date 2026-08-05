'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import IncidentList from './IncidentList';
import IncidentDrawer from './IncidentDrawer';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import type { Incident } from '@/lib/types';

const IncidentMap = dynamic(() => import('./IncidentMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center text-muted text-sm bg-soft">
      Loading map…
    </div>
  ),
});

export default function ConsoleShell() {
  const sb = useMemo(() => createSupabaseBrowser(), []);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'critical'>('all');
  const audio = useRef<HTMLAudioElement | null>(null);
  const originalTitle = useRef<string>('');
  const newCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/incidents?limit=200', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { incidents: Incident[] };
        if (!cancelled) setIncidents(j.incidents);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    originalTitle.current = document.title;
    const channel = sb
      .channel('incidents-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          const row = payload.new as Incident;
          setIncidents((prev) => (prev.some((i) => i.id === row.id) ? prev : [row, ...prev]));
          newCount.current += 1;
          document.title = `(${newCount.current}) ${originalTitle.current}`;
          try { audio.current?.play().catch(() => {}); } catch {}
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents' },
        (payload) => {
          const row = payload.new as Incident;
          setIncidents((prev) => prev.map((i) => (i.id === row.id ? { ...i, ...row } : i)));
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
      document.title = originalTitle.current;
    };
  }, [sb]);

  const visible = useMemo(() => {
    if (filter === 'open') return incidents.filter((i) => i.status !== 'resolved' && i.status !== 'cancelled');
    if (filter === 'critical') return incidents.filter((i) => i.severity === 3);
    return incidents;
  }, [incidents, filter]);

  const selected = useMemo(
    () => incidents.find((i) => i.id === selectedId) ?? null,
    [incidents, selectedId],
  );

  const patch = useCallback(
    async (id: string, changes: Partial<Incident>) => {
      setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
      const res = await fetch('/api/incidents', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...changes }),
      });
      if (!res.ok) setError(`patch failed: HTTP ${res.status}`);
    },
    [],
  );

  const clearBadge = useCallback(() => {
    newCount.current = 0;
    document.title = originalTitle.current;
  }, []);

  const openCount = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'cancelled').length;
  const criticalCount = incidents.filter((i) => i.severity === 3).length;

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[380px_1fr]"
      style={{ height: 'calc(100dvh - 3.5rem)' }}
    >
      <aside
        className="border-r border-line flex flex-col bg-white min-h-0 overflow-hidden"
        onClick={clearBadge}
      >
        <div className="px-5 pt-4 pb-3 border-b border-line shrink-0">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-extrabold tracking-tight">Incidents</h1>
            <span className="text-xs text-muted">{visible.length} shown</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {(['all', 'open', 'critical'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  'px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition ' +
                  (filter === f
                    ? 'bg-ink text-white'
                    : 'bg-soft text-subink hover:bg-line')
                }
              >
                {f}
                {f === 'open' && openCount > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-80">{openCount}</span>
                )}
                {f === 'critical' && criticalCount > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-80">{criticalCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <IncidentList
            incidents={visible}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </aside>
      <section className="relative h-full min-h-0 overflow-hidden">
        <IncidentMap
          incidents={incidents}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selected && (
          <IncidentDrawer
            incident={selected}
            onClose={() => setSelectedId(null)}
            onPatch={(changes) => patch(selected.id, changes)}
          />
        )}
        {error && (
          <div className="absolute bottom-3 left-3 right-3 md:right-auto md:max-w-md bg-accent text-white px-4 py-2.5 rounded-2xl text-sm shadow-card">
            {error}
          </div>
        )}
      </section>
      <audio ref={audio} preload="auto" />
    </div>
  );
}
