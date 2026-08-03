'use client';

import type { IncidentType } from '@/lib/types';

interface Props {
  value: IncidentType | null;
  onChange: (t: IncidentType) => void;
}

const OPTIONS: Array<{ value: IncidentType; label: string; glyph: string }> = [
  { value: 'ACC', label: 'Crash',       glyph: '✕' },
  { value: 'MED', label: 'Medical',     glyph: '+' },
  { value: 'FIR', label: 'Fire',        glyph: '△' },
  { value: 'BRK', label: 'Breakdown',   glyph: '⚙' },
  { value: 'OBS', label: 'Obstruction', glyph: '⚠' },
];

export default function TypeGrid({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Incident type" className="grid grid-cols-2 gap-3">
      {OPTIONS.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={
              'rounded-2xl border py-6 px-4 flex flex-col items-center justify-center gap-1 min-h-[92px] ' +
              (active
                ? 'bg-teal/20 border-teal text-ink'
                : 'bg-surface border-line hover:border-teal/60') +
              (i === OPTIONS.length - 1 ? ' col-span-2' : '')
            }
          >
            <span className="text-3xl leading-none">{opt.glyph}</span>
            <span className="text-base font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
