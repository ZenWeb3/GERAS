'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import IncidentList from './IncidentList';
import IncidentDrawer from './IncidentDrawer';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import type { Incident } from '@/lib/types';

// Leaflet touches window at module scope. Load it client-only or Next's build
// will die (see CLAUDE.md §6).
const IncidentMap = dynamic(() => import('./IncidentMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center text-muted text-sm">
      Loading map…
    </div>
  ),
});

export default function ConsoleShell() {
  const sb = useMemo(() => createSupabaseBrowser(), []);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    return () => {
      cancelled = true;
    };
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
          setIncidents((prev) =>
            prev.some((i) => i.id === row.id) ? prev : [row, ...prev],
          );
          newCount.current += 1;
          document.title = `(${newCount.current}) ${originalTitle.current}`;
          try { audio.current?.play().catch(() => {}); } catch { /* audio blocked */ }
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

  return (
    <div className="h-[calc(100vh-3rem)] grid grid-cols-[340px_1fr] bg-ground text-ink">
      <aside className="border-r border-line overflow-y-auto" onClick={clearBadge}>
        <IncidentList
          incidents={incidents}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </aside>
      <section className="relative">
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
          <div className="absolute bottom-3 left-3 right-3 md:right-auto md:max-w-md bg-critical/20 border border-critical text-ink px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}
      </section>
      <audio ref={audio} preload="auto" />
    </div>
  );
}
