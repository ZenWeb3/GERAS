'use client';

import { del, get, keys, set } from 'idb-keyval';
import type { IncidentType, Severity } from './types';

export type OutboxState = 'pending' | 'sent_https' | 'sms_attempted' | 'failed';

export interface OutboxItem {
  ref: string;
  lat: number;
  lon: number;
  accuracy_m: number;
  incident_type: IncidentType;
  severity: Severity;
  reporter_phone?: string;
  device_id: string;
  client_ts: string;
  state: OutboxState;
  updated_at: number;
  last_error?: string;
}

const PREFIX = 'geras:outbox:';

export async function saveOutbox(item: OutboxItem): Promise<void> {
  await set(PREFIX + item.ref, { ...item, updated_at: Date.now() });
}

export async function markOutbox(ref: string, patch: Partial<OutboxItem>): Promise<void> {
  const existing = (await get<OutboxItem>(PREFIX + ref)) ?? null;
  if (!existing) return;
  await set(PREFIX + ref, { ...existing, ...patch, updated_at: Date.now() });
}

export async function listPending(): Promise<OutboxItem[]> {
  const ks = await keys();
  const out: OutboxItem[] = [];
  for (const k of ks) {
    if (typeof k !== 'string' || !k.startsWith(PREFIX)) continue;
    const item = (await get<OutboxItem>(k)) ?? null;
    if (item && (item.state === 'pending' || item.state === 'sms_attempted' || item.state === 'failed')) {
      out.push(item);
    }
  }
  return out.sort((a, b) => a.updated_at - b.updated_at);
}

export async function dropOutbox(ref: string): Promise<void> {
  await del(PREFIX + ref);
}

// Long-lived device id kept in localStorage so per-device rate limits work
// across page reloads.
export function getDeviceId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  const KEY = 'geras:device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
