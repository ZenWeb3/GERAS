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

const severityText: Record<1 | 2 | 3, string> = {
  1: 'text-minor',
  2: 'text-[#a35a00]',
  3: 'text-accent',
};

export default function IncidentDrawer({ incident, onClose, onPatch }: Props) {
  const [notes, setNotes] = useState<string>(incident.notes ?? '');
  useEffect(() => setNotes(incident.notes ?? ''), [incident.id, incident.notes]);

  const isSms = incident.channel_first === 'sms';
  const seenBoth = incident.channels_seen.length > 1;
  const sev = incident.severity as 1 | 2 | 3;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-full md:max-w-md bg-white shadow-card border-l border-line overflow-y-auto">
      <div className="p-5 flex items-start justify-between border-b border-line">
        <div>
          <div className={'text-xs uppercase tracking-wider font-semibold ' + severityText[sev]}>
            {typeLabel[incident.incident_type]} · {severityLabel[sev]}
          </div>
          <div className="font-mono text-lg font-bold tracking-wider mt-1">{incident.ref}</div>
        </div>
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-soft hover:bg-line grid place-items-center text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="p-5 space-y-6 text-sm">
        <section>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2 font-semibold">Channel</div>
          <div className="flex flex-wrap gap-1.5">
            <span
              className={
                'text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold ' +
                (isSms ? 'bg-sms/10 text-sms' : 'bg-success/10 text-success')
              }
            >
              First: {incident.channel_first}
            </span>
            {seenBoth && (
              <span className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-soft text-subink font-semibold">
                Merged: {incident.channels_seen.join(' + ')}
              </span>
            )}
          </div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2 font-semibold">Location</div>
          <div className="font-mono text-base">{coord(incident.lat)}, {coord(incident.lon)}</div>
          <div className="text-muted text-xs mt-0.5">±{incident.accuracy_m ?? '—'} m</div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2 font-semibold">Timing</div>
          <div>
            Received {ago(incident.server_ts)} ago
            {incident.client_ts && ` (client sent ${ago(incident.client_ts)} ago)`}
          </div>
        </section>

        {incident.reporter_phone && (
          <section>
            <div className="text-[11px] uppercase tracking-wider text-muted mb-2 font-semibold">Reporter</div>
            <a
              href={`tel:${incident.reporter_phone}`}
              className="inline-flex items-center gap-2 rounded-full bg-soft hover:bg-line px-3 py-1.5 font-mono text-sm"
            >
              📞 {incident.reporter_phone}
            </a>
          </section>
        )}

        <section>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2 font-semibold">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => onPatch({ status: s })}
                className={
                  'text-xs px-3 py-1.5 rounded-full font-semibold transition ' +
                  (incident.status === s
                    ? 'bg-ink text-white'
                    : 'bg-soft text-subink hover:bg-line')
                }
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2 font-semibold">Nearest units</div>
          <UnitPanel
            lat={incident.lat}
            lon={incident.lon}
            assignedId={incident.assigned_unit_id}
            onAssign={(id) => onPatch({ assigned_unit_id: id, status: 'dispatched' })}
          />
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2 font-semibold">Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if ((notes || null) !== (incident.notes ?? null)) onPatch({ notes });
            }}
            rows={3}
            className="w-full rounded-2xl bg-soft focus:bg-white border border-transparent focus:border-ink outline-none px-3 py-2 text-sm"
            placeholder="Add operator notes…"
          />
        </section>
      </div>
    </div>
  );
}
