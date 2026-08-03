'use client';

import { useEffect, useState } from 'react';

interface Unit {
  id: string;
  callsign: string;
  station: string;
  phone: string | null;
  km: number;
  eta_min: number;
  status: string;
}

interface Props {
  lat: number;
  lon: number;
  assignedId: string | null;
  onAssign: (id: string) => void;
}

export default function UnitPanel({ lat, lon, assignedId, onAssign }: Props) {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUnits(null);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(`/api/units?lat=${lat}&lon=${lon}&limit=5`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { units: Unit[] };
        if (!cancelled) setUnits(j.units);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lon]);

  if (err) return <div className="text-accent text-xs">{err}</div>;
  if (units === null) return <div className="text-muted text-xs">Loading nearest units…</div>;
  if (units.length === 0) return <div className="text-muted text-xs">No units available.</div>;

  return (
    <ul className="space-y-2">
      {units.map((u) => {
        const isAssigned = u.id === assignedId;
        return (
          <li
            key={u.id}
            className={
              'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ' +
              (isAssigned ? 'bg-ink text-white' : 'bg-soft')
            }
          >
            <div className={'h-9 w-9 rounded-xl grid place-items-center font-mono text-xs font-bold ' +
              (isAssigned ? 'bg-white/15' : 'bg-white')}>
              {u.callsign.split('-')[1] ?? u.callsign.slice(-2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{u.callsign}</div>
              <div className={'text-xs ' + (isAssigned ? 'text-white/70' : 'text-muted')}>
                {u.station} · {u.km.toFixed(1)} km · ~{u.eta_min} min
              </div>
            </div>
            <button
              onClick={() => onAssign(u.id)}
              disabled={isAssigned}
              className={
                'text-xs font-semibold px-3 py-1.5 rounded-full transition ' +
                (isAssigned
                  ? 'bg-white/15 text-white'
                  : 'bg-accent text-white hover:bg-accent700')
              }
            >
              {isAssigned ? 'Assigned' : 'Assign'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
