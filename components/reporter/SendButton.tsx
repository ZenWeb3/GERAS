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
        'w-full min-h-[72px] rounded-full text-lg font-bold tracking-tight transition ' +
        (ready && !busy
          ? 'bg-accent text-white shadow-cta hover:bg-accent700 active:scale-[0.99]'
          : 'bg-soft text-muted')
      }
    >
      {busy ? 'Sending…' : (label ?? (ready ? 'Send alert' : 'Choose type and severity'))}
    </button>
  );
}
