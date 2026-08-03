import { describe, expect, it } from 'vitest';
import type { Channel } from '../lib/types';

// Mirrors the SQL `upsert_incident` merge rules so the dedup contract can be
// verified without a live Postgres. Kept in a single small pure function so a
// diff to it forces a matching diff to 001_schema.sql (and vice versa).

interface Row {
  ref: string;
  channel_first: Channel;
  channels_seen: Channel[];
  reporter_phone: string | null;
  accuracy_m: number | null;
  notes: string | null;
  server_ts: number;
  client_ts: number | null;
}

interface Incoming {
  ref: string;
  channel: Channel;
  reporter_phone?: string | null;
  accuracy_m?: number | null;
  notes?: string | null;
  client_ts?: number | null;
}

function uniq<T>(a: T[]): T[] {
  return Array.from(new Set(a));
}

function upsert(existing: Row | null, incoming: Incoming, now: number): { row: Row; created: boolean } {
  if (!existing) {
    return {
      row: {
        ref: incoming.ref,
        channel_first: incoming.channel,
        channels_seen: [incoming.channel],
        reporter_phone: incoming.reporter_phone ?? null,
        accuracy_m: incoming.accuracy_m ?? null,
        notes: incoming.notes ?? null,
        server_ts: now,
        client_ts: incoming.client_ts ?? null,
      },
      created: true,
    };
  }
  return {
    row: {
      ...existing,
      channels_seen: uniq([...existing.channels_seen, incoming.channel]),
      reporter_phone: existing.reporter_phone ?? incoming.reporter_phone ?? null,
      accuracy_m: existing.accuracy_m ?? incoming.accuracy_m ?? null,
      notes: existing.notes ?? incoming.notes ?? null,
      client_ts:
        existing.client_ts != null && incoming.client_ts != null
          ? Math.min(existing.client_ts, incoming.client_ts)
          : (existing.client_ts ?? incoming.client_ts ?? null),
    },
    created: false,
  };
}

describe('dedup / merge on ref', () => {
  it('inserts on first sight', () => {
    const { row, created } = upsert(null, { ref: 'A1B2C3', channel: 'sms' }, 1000);
    expect(created).toBe(true);
    expect(row.channel_first).toBe('sms');
    expect(row.channels_seen).toEqual(['sms']);
  });

  it('SMS then HTTPS with same ref → one row, channels_seen={sms,https}, sms wins channel_first', () => {
    const first = upsert(null, { ref: 'A1B2C3', channel: 'sms', client_ts: 100 }, 500);
    const second = upsert(first.row, { ref: 'A1B2C3', channel: 'https', client_ts: 80 }, 600);
    expect(second.created).toBe(false);
    expect(second.row.channel_first).toBe('sms');
    expect(second.row.channels_seen.sort()).toEqual(['https', 'sms']);
    expect(second.row.server_ts).toBe(500); // first arrival wins
  });

  it('HTTPS then SMS with same ref → https wins channel_first, both listed in seen', () => {
    const first = upsert(null, { ref: 'REF001', channel: 'https' }, 100);
    const second = upsert(first.row, { ref: 'REF001', channel: 'sms' }, 200);
    expect(second.row.channel_first).toBe('https');
    expect(second.row.channels_seen.sort()).toEqual(['https', 'sms']);
  });

  it('later arrival enriches null fields but never overwrites populated ones', () => {
    const first = upsert(
      null,
      { ref: 'REF002', channel: 'sms', reporter_phone: null, accuracy_m: null, notes: null },
      100,
    );
    const second = upsert(
      first.row,
      {
        ref: 'REF002',
        channel: 'https',
        reporter_phone: '+2348031234567',
        accuracy_m: 8,
        notes: 'car flipped',
      },
      200,
    );
    expect(second.row.reporter_phone).toBe('+2348031234567');
    expect(second.row.accuracy_m).toBe(8);
    expect(second.row.notes).toBe('car flipped');
  });

  it('later arrival never overwrites a populated field', () => {
    const first = upsert(
      null,
      { ref: 'REF003', channel: 'https', reporter_phone: '+2348030000001', accuracy_m: 5 },
      100,
    );
    const second = upsert(
      first.row,
      { ref: 'REF003', channel: 'sms', reporter_phone: '+2349999999999', accuracy_m: 200 },
      200,
    );
    expect(second.row.reporter_phone).toBe('+2348030000001');
    expect(second.row.accuracy_m).toBe(5);
  });

  it('same channel arriving twice does not duplicate channels_seen', () => {
    const first = upsert(null, { ref: 'REF004', channel: 'https' }, 100);
    const second = upsert(first.row, { ref: 'REF004', channel: 'https' }, 200);
    expect(second.row.channels_seen).toEqual(['https']);
  });

  it('keeps earliest client_ts when both provided', () => {
    const first = upsert(null, { ref: 'REF005', channel: 'sms', client_ts: 500 }, 500);
    const second = upsert(first.row, { ref: 'REF005', channel: 'https', client_ts: 300 }, 600);
    expect(second.row.client_ts).toBe(300);
  });
});
