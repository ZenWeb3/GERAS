'use client';

import { useEffect, useState } from 'react';
import UnitPanel from './UnitPanel';
import { ago, coord, severityLabel, statusLabel, typeLabel } from '@/lib/format';
import type { Incident, Status } from '@/lib/types';

interface Props {
  incident: Incident;
  onClose: () => void;
  onPatch: (changes: Partial<Incident>) => Promise<void> | void;
}

const STATUSES: Status[] = ['new', 'triaged', 'dispatched', 'onscene', 'resolved', 'cancelled'];

export default function IncidentDrawer({ incident, onClose, onPatch }: Props) {
  const [notes, setNotes] = useState<string>(incident.notes ?? '');

  useEffect(() => {
    setNotes(incident.notes ?? '');
  }, [incident.id, incident.notes]);

  const isSms = incident.channel_first === 'sms';
  const seenBoth = incident.channels_seen.length > 1;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-surface/95 backdrop-blur border-l border-line overflow-y-auto">
      <div className="p-4 flex items-start justify-between border-b border-line">
        <div>
          <div className="text-xs text-muted uppercase tracking-wider">
            {typeLabel[incident.incident_type]} · {severityLabel[incident.severity as 1 | 2 | 3]}
          </div>
          <div className="font-mono text-sm mt-0.5">{incident.ref}</div>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-ink text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="p-4 space-y-4 text-sm">
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Channel</div>
          <div className="flex flex-wrap gap-1.5">
            <span
              className={
                'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ' +
                (isSms
                  ? 'bg-sms/15 text-sms border-sms/40'
                  : 'bg-teal/10 text-teal border-teal/40')
              }
            >
              First: {incident.channel_first}
            </span>
            {seenBoth && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border bg-surface2 text-ink border-line">
                Merged: {incident.channels_seen.join(' + ')}
              </span>
            )}
          </div>
        </section>

        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Location</div>
          <div className="font-mono">
            {coord(incident.lat)}, {coord(incident.lon)}
          </div>
          <div className="text-muted text-xs mt-0.5">
            ±{incident.accuracy_m ?? '—'} m
          </div>
        </section>

        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Timing</div>
          <div>
            Received {ago(incident.server_ts)} ago
            {incident.client_ts &&
              ` (client sent ${ago(incident.client_ts)} ago)`}
          </div>
        </section>

        {incident.reporter_phone && (
          <section>
            <div className="text-xs uppercase tracking-wider text-muted mb-1">Reporter</div>
            <a
              href={`tel:${incident.reporter_phone}`}
              className="text-teal hover:underline font-mono"
            >
              {incident.reporter_phone}
            </a>
          </section>
        )}

        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => onPatch({ status: s })}
                className={
                  'text-xs px-2.5 py-1 rounded border ' +
                  (incident.status === s
                    ? 'bg-teal/20 text-teal border-teal/60'
                    : 'bg-surface2 text-ink border-line hover:border-teal/40')
                }
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Nearest units</div>
          <UnitPanel
            lat={incident.lat}
            lon={incident.lon}
            assignedId={incident.assigned_unit_id}
            onAssign={(id) => onPatch({ assigned_unit_id: id, status: 'dispatched' })}
          />
        </section>

        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if ((notes || null) !== (incident.notes ?? null)) {
                onPatch({ notes });
              }
            }}
            rows={3}
            className="w-full rounded bg-surface2 border border-line px-2 py-1.5 text-sm"
          />
        </section>
      </div>
    </div>
  );
}
