'use client';

export interface Fix {
  lat: number;
  lon: number;
  accuracy_m: number;
  timestamp: number;
  stale?: boolean;
}

let cached: Fix | null = null;
let watcherId: number | null = null;

const FRESH_MS = 30_000;
const GOOD_ACC = 100;
const HARD_TIMEOUT_MS = 8_000;

export function startWatching(): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  if (watcherId !== null) return;
  watcherId = navigator.geolocation.watchPosition(
    (pos) => {
      cached = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy,
        timestamp: Date.now(),
      };
    },
    () => { /* silent — getFix() will retry via getCurrentPosition */ },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
  );
}

export function stopWatching(): void {
  if (watcherId !== null && navigator?.geolocation) {
    navigator.geolocation.clearWatch(watcherId);
    watcherId = null;
  }
}

export function getCached(): Fix | null {
  return cached;
}

/**
 * Never blocks the alert waiting for a perfect lock. A cold GNSS fix without
 * A-GPS assistance can take 30–60s — that's exactly the wrong minute. Returns
 * the freshest usable fix or the last cached fix flagged stale.
 */
export async function getFix(): Promise<Fix> {
  const now = Date.now();
  if (cached && now - cached.timestamp < FRESH_MS && cached.accuracy_m < GOOD_ACC) {
    return cached;
  }
  if (!navigator?.geolocation) {
    if (cached) return { ...cached, stale: true };
    throw new Error('geolocation_unavailable');
  }
  return new Promise<Fix>((resolve, reject) => {
    const settle = (pos: GeolocationPosition) => {
      const fix: Fix = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy,
        timestamp: Date.now(),
      };
      cached = fix;
      resolve(fix);
    };
    navigator.geolocation.getCurrentPosition(
      settle,
      () => {
        if (cached) resolve({ ...cached, stale: true });
        else reject(new Error('geo_error_no_cache'));
      },
      { enableHighAccuracy: true, timeout: HARD_TIMEOUT_MS, maximumAge: 30_000 },
    );
  });
}
