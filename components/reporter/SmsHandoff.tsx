'use client';

interface Props {
  ref: string;
  payload: string;
  smsUri: string;
  onReset: () => void;
}

export default function SmsHandoff({ ref, payload, smsUri, onReset }: Props) {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col p-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 max-w-md mx-auto w-full">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sms/10 text-sms px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-sms" />
            SMS fallback
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight mt-4">
            Messaging app is opening.
          </h2>
          <p className="text-subink mt-2">
            Tap <span className="font-bold text-ink">Send</span> in your messages to alert FRSC.
          </p>
        </div>
        <a
          href={smsUri}
          className="w-full min-h-[68px] inline-flex items-center justify-center rounded-full bg-ink text-white font-semibold text-lg shadow-card"
        >
          Open messaging app
        </a>
        <div className="w-full text-left space-y-3 bg-soft rounded-2xl p-4">
          <div>
            <div className="text-xs text-muted uppercase tracking-wider">Reference</div>
            <div className="font-mono text-2xl font-bold tracking-wider mt-0.5">{ref}</div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wider">Message (copy if needed)</div>
            <div className="font-mono text-xs bg-white border border-line rounded-xl p-3 break-all select-all mt-1">
              {payload}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onReset}
        className="mt-6 text-subink underline text-sm mx-auto"
      >
        Report another incident
      </button>
    </div>
  );
}
