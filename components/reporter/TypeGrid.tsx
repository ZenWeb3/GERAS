'use client';

import type { IncidentType } from '@/lib/types';

interface Props {
  value: IncidentType | null;
  onChange: (t: IncidentType) => void;
}

interface Option {
  value: IncidentType;
  label: string;
  Icon: (p: { className?: string }) => JSX.Element;
}

const CarIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 17h14M5 17l1.5-6h11L19 17M5 17v2h2v-2M17 17v2h2v-2" />
    <circle cx="8" cy="17" r="1.5" fill="currentColor"/>
    <circle cx="16" cy="17" r="1.5" fill="currentColor"/>
  </svg>
);
const MedIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const FireIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3s3 3 3 6-1.5 4-3 4-3-1-3-4c0 0-3 3-3 7a6 6 0 0012 0c0-5-3-8-6-13z" />
  </svg>
);
const WrenchIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.7 6.3a4 4 0 105.4 5.4l-2-2 2-2-2-2-2 2-2-2z" />
    <path d="M13 10L4 19l2 2 9-9" />
  </svg>
);
const WarnIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18v.5" />
  </svg>
);

const OPTIONS: Option[] = [
  { value: 'ACC', label: 'Crash',       Icon: CarIcon },
  { value: 'MED', label: 'Medical',     Icon: MedIcon },
  { value: 'FIR', label: 'Fire',        Icon: FireIcon },
  { value: 'BRK', label: 'Breakdown',   Icon: WrenchIcon },
  { value: 'OBS', label: 'Obstruction', Icon: WarnIcon },
];

export default function TypeGrid({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Incident type" className="grid grid-cols-2 gap-3">
      {OPTIONS.map((opt, i) => {
        const active = opt.value === value;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={
              'rounded-2xl px-4 py-5 min-h-[104px] flex flex-col items-start justify-between text-left transition ' +
              (active
                ? 'bg-ink text-white shadow-card'
                : 'bg-soft text-ink hover:bg-line') +
              (i === OPTIONS.length - 1 ? ' col-span-2' : '')
            }
          >
            <Icon className={'h-7 w-7 ' + (active ? 'text-white' : 'text-ink')} />
            <span className="text-base font-semibold mt-2">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
