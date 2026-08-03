'use client';

/**
 * navigator.onLine is a fast negative only. Nigerian carriers return "online"
 * with zero throughput constantly. If it's false we can skip the probe; if
 * it's true we still have to actually hit /api/health.
 */
export async function probeOnline(timeoutMs: number = 3500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const res = await fetch(`/api/health?t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}
