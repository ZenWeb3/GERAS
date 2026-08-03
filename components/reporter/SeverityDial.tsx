'use client';

import type { Severity } from '@/lib/types';

interface Props {
  value: Severity | null;
  onChange: (s: Severity) => void;
}

const LEVELS: Array<{ value: Severity; label: string; sub: string; klass: string }> = [
  { value: 1, label: 'Minor',    sub: 'No injuries',  klass: 'bg-minor/20 border-minor text-minor' },
  { value: 2, label: 'Serious',  sub: 'Injuries',     klass: 'bg-serious/20 border-serious text-serious' },
  { value: 3, label: 'Critical', sub: 'Life at risk', klass: 'bg-critical/25 border-critical text-critical' },
];

export default function SeverityDial({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Severity" className="grid grid-cols-3 gap-2">
      {LEVELS.map((l) => {
        const active = l.value === value;
        return (
          <button
            key={l.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(l.value)}
            className={
              'rounded-xl border py-3 px-2 flex flex-col items-center ' +
              (active ? l.klass : 'bg-surface border-line hover:border-teal/60')
            }
          >
            <span className="text-base font-medium">{l.label}</span>
            <span className="text-[11px] text-muted">{l.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
