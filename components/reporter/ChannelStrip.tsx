'use client';

interface Props {
  online: boolean | null;
  accuracy_m: number | null;
  stale: boolean;
}

export default function ChannelStrip({ online, accuracy_m, stale }: Props) {
  const channel =
    online === null ? 'Checking…' : online ? 'Data' : 'SMS fallback';
  const dotColor =
    online === null ? 'bg-muted' : online ? 'bg-success' : 'bg-sms';
  const gps =
    accuracy_m === null ? '— m' : `±${accuracy_m.toFixed(0)} m` + (stale ? ' (stale)' : '');
  return (
    <div className="flex items-center justify-between text-sm px-5 py-3 bg-white border-b border-line">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-ink" />
        <span className={'font-medium ' + (stale ? 'text-serious' : 'text-ink')}>{gps}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={'h-2 w-2 rounded-full ' + dotColor} />
        <span className="font-medium">{channel}</span>
      </div>
    </div>
  );
}
