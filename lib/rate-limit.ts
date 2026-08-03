// In-memory sliding-window rate limiter. Adequate for a single-instance FYP
// deploy; swap for Upstash if you scale horizontally.

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retry_after_s: number;
}

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
): LimitResult {
  const b = store.get(key) ?? { hits: [] };
  const cutoff = now - windowMs;
  b.hits = b.hits.filter((t) => t > cutoff);
  if (b.hits.length >= max) {
    store.set(key, b);
    const oldest = b.hits[0];
    return {
      ok: false,
      remaining: 0,
      retry_after_s: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }
  b.hits.push(now);
  store.set(key, b);
  return { ok: true, remaining: max - b.hits.length, retry_after_s: 0 };
}

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? '0.0.0.0';
}
