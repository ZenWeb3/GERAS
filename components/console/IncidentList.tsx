'use client';

import { ago, coord, severityLabel, statusLabel, typeLabel } from '@/lib/format';
import type { Incident } from '@/lib/types';

interface Props {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const severityChip: Record<1 | 2 | 3, string> = {
  1: 'bg-minor/15 text-minor',
  2: 'bg-serious/15 text-[#a35a00]',
  3: 'bg-accent/15 text-accent',
};

export default function IncidentList({ incidents, selectedId, onSelect }: Props) {
  if (incidents.length === 0) {
    return (
      <div className="p-8 text-center text-muted text-sm">
        No incidents match this filter.
      </div>
    );
  }
  return (
    <ul>
      {incidents.map((i) => {
        const isSelected = i.id === selectedId;
        const isSms = i.channel_first === 'sms';
        const sev = i.severity as 1 | 2 | 3;
        return (
          <li key={i.id}>
            <button
              onClick={() => onSelect(i.id)}
              className={
                'w-full text-left px-5 py-4 border-b border-line flex gap-3 items-start transition ' +
                (isSelected ? 'bg-soft' : 'hover:bg-soft/60')
              }
            >
              <div
                className={
                  'mt-0.5 h-10 w-10 shrink-0 rounded-2xl grid place-items-center text-xs font-bold ' +
                  severityChip[sev]
                }
              >
                {i.incident_type}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold truncate">{typeLabel[i.incident_type]}</span>
                  <span className="text-muted text-xs">·</span>
                  <span className="text-xs text-subink">{severityLabel[sev]}</span>
                  {isSms && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-sms/10 text-sms px-1.5 py-0.5 rounded-full font-semibold">
                      <span className="h-1 w-1 rounded-full bg-sms" />
                      SMS
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted font-mono mt-1">
                  {i.ref} · {coord(i.lat)}, {coord(i.lon)}
                </div>
                <div className="text-xs text-subink mt-1.5 flex gap-2 items-center">
                  <span className="font-medium">{statusLabel[i.status]}</span>
                  <span className="text-muted">·</span>
                  <span className="text-muted">{ago(i.server_ts)} ago</span>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
