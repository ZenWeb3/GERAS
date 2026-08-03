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
        const res = await fetch(`/api/units?lat=${lat}&lon=${lon}&limit=5`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { units: Unit[] };
        if (!cancelled) setUnits(j.units);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  if (err) return <div className="text-critical text-xs">{err}</div>;
  if (units === null) return <div className="text-muted text-xs">Loading nearest units…</div>;
  if (units.length === 0) return <div className="text-muted text-xs">No units available.</div>;

  return (
    <ul className="space-y-1.5">
      {units.map((u) => {
        const isAssigned = u.id === assignedId;
        return (
          <li
            key={u.id}
            className={
              'flex items-center gap-2 rounded border px-2 py-1.5 text-xs ' +
              (isAssigned ? 'border-teal/60 bg-teal/10' : 'border-line bg-surface2')
            }
          >
            <div className="flex-1 min-w-0">
              <div className="font-mono">{u.callsign}</div>
              <div className="text-muted">
                {u.station} · {u.km.toFixed(1)} km · ~{u.eta_min} min
              </div>
            </div>
            <button
              onClick={() => onAssign(u.id)}
              disabled={isAssigned}
              className={
                'text-[11px] uppercase tracking-wider px-2 py-1 rounded ' +
                (isAssigned
                  ? 'bg-teal/20 text-teal'
                  : 'bg-teal/80 hover:bg-teal text-black')
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
