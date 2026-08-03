import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">GERAS</h1>
          <p className="text-muted mt-2 text-sm">
            Hybrid dual-channel geospatial emergency alert system.
          </p>
        </div>
        <div className="grid gap-3">
          <Link
            href="/report"
            className="block rounded-xl bg-critical/90 hover:bg-critical text-white font-medium py-4"
          >
            Report an incident
          </Link>
          <Link
            href="/console"
            className="block rounded-xl border border-line hover:bg-surface py-4"
          >
            Dispatch console
          </Link>
        </div>
      </div>
    </main>
  );
}
