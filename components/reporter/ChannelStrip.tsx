'use client';

interface Props {
  online: boolean | null;
  accuracy_m: number | null;
  stale: boolean;
}

export default function ChannelStrip({ online, accuracy_m, stale }: Props) {
  const channel =
    online === null ? 'Checking…' : online ? 'Data' : 'SMS fallback';
  const channelColor =
    online === null
      ? 'text-muted'
      : online
      ? 'text-teal'
      : 'text-sms';
  const gps =
    accuracy_m === null
      ? '— m'
      : `±${accuracy_m.toFixed(0)} m` + (stale ? ' (stale)' : '');
  return (
    <div className="flex items-center justify-between text-xs px-3 py-2 bg-surface border-b border-line">
      <div>
        <span className="text-muted uppercase tracking-wider">GPS </span>
        <span className={'font-mono ' + (stale ? 'text-serious' : 'text-ink')}>{gps}</span>
      </div>
      <div>
        <span className="text-muted uppercase tracking-wider">Channel </span>
        <span className={'font-medium ' + channelColor}>{channel}</span>
      </div>
    </div>
  );
}
