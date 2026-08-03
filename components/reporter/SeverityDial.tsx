'use client';

import type { Severity } from '@/lib/types';

interface Props {
  value: Severity | null;
  onChange: (s: Severity) => void;
}

const LEVELS: Array<{ value: Severity; label: string; sub: string; dot: string; activeBg: string }> = [
  { value: 1, label: 'Minor',    sub: 'No injuries',  dot: 'bg-minor',   activeBg: 'ring-minor' },
  { value: 2, label: 'Serious',  sub: 'Injuries',     dot: 'bg-serious', activeBg: 'ring-serious' },
  { value: 3, label: 'Critical', sub: 'Life at risk', dot: 'bg-accent',  activeBg: 'ring-accent' },
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
              'rounded-2xl px-2 py-4 flex flex-col items-center gap-1.5 transition ' +
              (active
                ? `bg-white ring-2 ${l.activeBg} shadow-card`
                : 'bg-soft hover:bg-line')
            }
          >
            <span className={'h-3 w-3 rounded-full ' + l.dot} />
            <span className="text-sm font-semibold">{l.label}</span>
            <span className="text-[11px] text-muted">{l.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
