import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-ink text-white grid place-items-center font-bold text-lg">G</div>
          <span className="font-semibold tracking-tight">GERAS</span>
        </div>
        <Link href="/login" className="text-sm text-subink hover:text-ink">
          Dispatcher sign-in
        </Link>
      </header>

      <section className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-lg mx-auto w-full">
        <p className="text-xs uppercase tracking-[0.18em] text-muted mb-4">FRSC · Emergency</p>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.02]">
          Report a road<br />emergency in <span className="text-accent">seconds.</span>
        </h1>
        <p className="mt-5 text-lg text-subink max-w-md">
          One tap. Your location is sent over data — or your messaging app if there&apos;s no signal.
        </p>

        <div className="mt-10 space-y-3">
          <Link
            href="/report"
            className="block w-full text-center rounded-full bg-accent hover:bg-accent700 text-white text-lg font-semibold py-5 shadow-cta transition"
          >
            Report an incident
          </Link>
          <Link
            href="/console"
            className="block w-full text-center rounded-full bg-soft hover:bg-line text-ink text-base font-medium py-4"
          >
            Open dispatch console
          </Link>
        </div>

        <ul className="mt-12 grid grid-cols-3 gap-4 text-center">
          <li>
            <div className="text-2xl font-bold">2</div>
            <div className="text-xs text-muted mt-1">channels<br />(data · SMS)</div>
          </li>
          <li>
            <div className="text-2xl font-bold">1.1 m</div>
            <div className="text-xs text-muted mt-1">location<br />precision</div>
          </li>
          <li>
            <div className="text-2xl font-bold">6 s</div>
            <div className="text-xs text-muted mt-1">to failover<br />on data loss</div>
          </li>
        </ul>
      </section>
    </main>
  );
}
