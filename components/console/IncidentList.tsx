'use client';

import { ago, coord, severityLabel, statusLabel, typeLabel } from '@/lib/format';
import type { Incident } from '@/lib/types';

interface Props {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const severityRing: Record<1 | 2 | 3, string> = {
  1: 'ring-minor',
  2: 'ring-serious',
  3: 'ring-critical',
};

export default function IncidentList({ incidents, selectedId, onSelect }: Props) {
  if (incidents.length === 0) {
    return (
      <div className="p-4 text-muted text-sm">No incidents.</div>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {incidents.map((i) => {
        const isSelected = i.id === selectedId;
        const isSms = i.channel_first === 'sms';
        return (
          <li key={i.id}>
            <button
              onClick={() => onSelect(i.id)}
              className={
                'w-full text-left px-3 py-2.5 flex gap-3 items-start hover:bg-surface ' +
                (isSelected ? 'bg-surface2' : '')
              }
            >
              <div
                className={
                  'mt-1 h-2.5 w-2.5 rounded-full ring-2 ring-offset-2 ring-offset-ground shrink-0 ' +
                  severityRing[i.severity as 1 | 2 | 3] +
                  (i.severity === 3 ? ' bg-critical' :
                    i.severity === 2 ? ' bg-serious' : ' bg-minor')
                }
                aria-label={severityLabel[i.severity as 1 | 2 | 3]}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{typeLabel[i.incident_type]}</span>
                  <span className="text-xs text-muted">·</span>
                  <span className="text-xs text-muted">{severityLabel[i.severity as 1 | 2 | 3]}</span>
                  {isSms && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider bg-sms/15 text-sms px-1.5 py-0.5 rounded border border-sms/30">
                      SMS
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted font-mono mt-0.5">
                  {i.ref} · {coord(i.lat)}, {coord(i.lon)}
                </div>
                <div className="text-xs text-muted mt-0.5 flex gap-2">
                  <span>{statusLabel[i.status]}</span>
                  <span>·</span>
                  <span>{ago(i.server_ts)} ago</span>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
