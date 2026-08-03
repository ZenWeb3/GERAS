'use client';

interface Props {
  ready: boolean;
  busy: boolean;
  onClick: () => void;
  label?: string;
}

export default function SendButton({ ready, busy, onClick, label }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={!ready || busy}
      aria-busy={busy}
      className={
        'w-full min-h-[72px] rounded-2xl text-lg font-semibold ' +
        (ready && !busy
          ? 'bg-critical text-white shadow-lg shadow-critical/30 active:scale-[0.99]'
          : 'bg-surface2 text-muted border border-line')
      }
    >
      {busy ? 'Sending…' : (label ?? (ready ? 'Send alert' : 'Choose type and severity'))}
    </button>
  );
}
