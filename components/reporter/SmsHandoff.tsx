'use client';

interface Props {
  ref: string;
  payload: string;
  smsUri: string;
  onReset: () => void;
}

export default function SmsHandoff({ ref, payload, smsUri, onReset }: Props) {
  return (
    <div className="fixed inset-0 bg-ground/95 backdrop-blur z-50 flex flex-col p-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 max-w-md mx-auto">
        <div>
          <div className="text-sms text-sm uppercase tracking-wider">SMS fallback</div>
          <h2 className="text-2xl font-semibold mt-2">
            Your messaging app is opening.
          </h2>
          <p className="text-muted mt-2">Tap <span className="text-ink font-semibold">Send</span> to alert FRSC.</p>
        </div>
        <a
          href={smsUri}
          className="w-full min-h-[64px] inline-flex items-center justify-center rounded-2xl bg-sms text-black font-semibold text-lg"
        >
          Open messaging app
        </a>
        <div className="w-full text-left space-y-2">
          <div className="text-xs text-muted uppercase tracking-wider">Ref</div>
          <div className="font-mono text-lg">{ref}</div>
          <div className="text-xs text-muted uppercase tracking-wider mt-3">Message (copy if needed)</div>
          <div className="font-mono text-xs bg-surface2 border border-line rounded p-2 break-all select-all">
            {payload}
          </div>
        </div>
      </div>
      <button
        onClick={onReset}
        className="mt-6 text-muted underline text-sm mx-auto"
      >
        Report another incident
      </button>
    </div>
  );
}
