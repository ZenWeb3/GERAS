'use client';

import { buildPayload, generateRef } from './sms-payload';
import { getFix } from './geo';
import { probeOnline } from './net';
import { dropOutbox, getDeviceId, listPending, markOutbox, saveOutbox } from './outbox';
import type { IncidentType, Severity } from './types';

export interface SubmitInput {
  incident_type: IncidentType;
  severity: Severity;
  reporter_phone?: string;
}

export type SubmitOutcome =
  | { kind: 'sent_https'; ref: string; accuracy_m: number; stale_fix: boolean }
  | { kind: 'sms_handoff'; ref: string; payload: string; sms_uri: string; accuracy_m: number; stale_fix: boolean }
  | { kind: 'error'; message: string };

function smsUri(shortcode: string, payload: string): string {
  // Some iOS versions want &body=, Android/others accept ?body=.
  const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?';
  return `sms:${shortcode}${sep}body=${encodeURIComponent(payload)}`;
}

async function postReport(body: Record<string, unknown>, signal: AbortSignal): Promise<boolean> {
  const res = await fetch('/api/report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  return res.ok;
}

/**
 * Core channel-decision. See CLAUDE.md §5.
 */
export async function submit(input: SubmitInput, shortcode: string): Promise<SubmitOutcome> {
  const device_id = getDeviceId();
  const ref = generateRef();
  const client_ts = new Date().toISOString();

  let fix;
  try {
    fix = await getFix();
  } catch (e) {
    return { kind: 'error', message: `no_gps: ${(e as Error).message}` };
  }

  const item = {
    ref,
    lat: Number(fix.lat.toFixed(5)),
    lon: Number(fix.lon.toFixed(5)),
    accuracy_m: Math.min(9999, Math.round(fix.accuracy_m)),
    incident_type: input.incident_type,
    severity: input.severity,
    reporter_phone: input.reporter_phone,
    device_id,
    client_ts,
    state: 'pending' as const,
    updated_at: Date.now(),
  };
  await saveOutbox(item);

  const online = await probeOnline();
  if (online) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ok = await postReport(
          {
            ref,
            lat: item.lat,
            lon: item.lon,
            accuracy_m: item.accuracy_m,
            incident_type: item.incident_type,
            severity: item.severity,
            reporter_phone: item.reporter_phone ?? null,
            device_id,
            client_ts,
          },
          AbortSignal.timeout(6000),
        );
        if (ok) {
          await markOutbox(ref, { state: 'sent_https' });
          await dropOutbox(ref);
          return { kind: 'sent_https', ref, accuracy_m: item.accuracy_m, stale_fix: !!fix.stale };
        }
      } catch {
        // fall through to retry, then to SMS
      }
    }
  }

  // Failover.
  const payload = buildPayload({
    ref,
    lat: item.lat,
    lon: item.lon,
    accuracy_m: item.accuracy_m,
    incident_type: item.incident_type,
    severity: item.severity,
    reporter_phone: item.reporter_phone,
  });
  await markOutbox(ref, { state: 'sms_attempted' });
  const uri = smsUri(shortcode, payload);
  return { kind: 'sms_handoff', ref, payload, sms_uri: uri, accuracy_m: item.accuracy_m, stale_fix: !!fix.stale };
}

/**
 * Reconcile any pending or SMS-attempted items when connectivity returns.
 * Server merges on `ref` so this is safe to re-run.
 */
export async function reconcile(): Promise<{ resent: number; failed: number }> {
  const items = await listPending();
  let resent = 0;
  let failed = 0;
  for (const it of items) {
    try {
      const ok = await postReport(
        {
          ref: it.ref,
          lat: it.lat,
          lon: it.lon,
          accuracy_m: it.accuracy_m,
          incident_type: it.incident_type,
          severity: it.severity,
          reporter_phone: it.reporter_phone ?? null,
          device_id: it.device_id,
          client_ts: it.client_ts,
        },
        AbortSignal.timeout(6000),
      );
      if (ok) {
        await dropOutbox(it.ref);
        resent++;
      } else {
        await markOutbox(it.ref, { state: 'failed', last_error: 'http_not_ok' });
        failed++;
      }
    } catch (e) {
      await markOutbox(it.ref, { state: 'failed', last_error: (e as Error).message });
      failed++;
    }
  }
  return { resent, failed };
}
