import { describe, expect, it } from 'vitest';
import {
  buildPayload,
  parsePayload,
  generateRef,
  PayloadError,
} from '../lib/sms-payload';

describe('generateRef', () => {
  it('produces 6-char Crockford base32 strings', () => {
    for (let i = 0; i < 200; i++) {
      const ref = generateRef();
      expect(ref).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
    }
  });

  it('is deterministic given a seeded RNG', () => {
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
    let i = 0;
    const rng = () => seq[i++];
    expect(generateRef(rng)).toBe('369CGK');
  });
});

describe('buildPayload', () => {
  const base = {
    ref: 'A3F2K9',
    lat: 4.90570,
    lon: 7.85370,
    accuracy_m: 12,
    incident_type: 'ACC' as const,
    severity: 2 as const,
  };

  it('formats the canonical example', () => {
    expect(buildPayload(base)).toBe('GERAS A3F2K9 4.90570 7.85370 12 ACC 2');
  });

  it('appends optional phone', () => {
    expect(buildPayload({ ...base, reporter_phone: '08031234567' })).toBe(
      'GERAS A3F2K9 4.90570 7.85370 12 ACC 2 08031234567',
    );
  });

  it('fits in a single GSM-7 segment (<=160)', () => {
    const msg = buildPayload({ ...base, reporter_phone: '+2348031234567' });
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it('clamps accuracy > 9999', () => {
    const msg = buildPayload({ ...base, accuracy_m: 999999 });
    expect(msg).toContain(' 9999 ');
  });

  it('rejects bad ref', () => {
    // valid ref accepted case-insensitively
    expect(() => buildPayload({ ...base, ref: 'a3f2k9' })).not.toThrow();
    expect(() => buildPayload({ ...base, ref: 'AB' })).toThrow(PayloadError);
    expect(() => buildPayload({ ...base, ref: 'A3F2K9I' })).toThrow(PayloadError);
    expect(() => buildPayload({ ...base, ref: 'A3F2KI' })).toThrow(PayloadError); // I not in alphabet
    expect(() => buildPayload({ ...base, ref: 'LOWERO' })).toThrow(PayloadError); // L and O excluded
  });

  it('rejects bad severity', () => {
    expect(() => buildPayload({ ...base, severity: 4 as unknown as 3 })).toThrow(PayloadError);
    expect(() => buildPayload({ ...base, severity: 0 as unknown as 1 })).toThrow(PayloadError);
  });

  it('rejects malformed phone', () => {
    expect(() => buildPayload({ ...base, reporter_phone: '123' })).toThrow(PayloadError);
    expect(() => buildPayload({ ...base, reporter_phone: 'abcdefghij' })).toThrow(PayloadError);
  });
});

describe('parsePayload', () => {
  it('parses the canonical example', () => {
    const p = parsePayload('GERAS A3F2K9 4.90570 7.85370 12 ACC 2 08031234567');
    expect(p).toEqual({
      ref: 'A3F2K9',
      lat: 4.90570,
      lon: 7.85370,
      accuracy_m: 12,
      incident_type: 'ACC',
      severity: 2,
      reporter_phone: '08031234567',
    });
  });

  it('parses without optional phone', () => {
    const p = parsePayload('GERAS A3F2K9 4.90570 7.85370 12 ACC 2');
    expect(p.reporter_phone).toBeUndefined();
    expect(p.ref).toBe('A3F2K9');
  });

  it('is case-insensitive on keyword and type', () => {
    const p = parsePayload('geras A3F2K9 4.90570 7.85370 12 acc 2');
    expect(p.incident_type).toBe('ACC');
  });

  it('tolerates leading/trailing whitespace', () => {
    const p = parsePayload('  GERAS A3F2K9 4.90570 7.85370 12 ACC 2   ');
    expect(p.ref).toBe('A3F2K9');
  });

  it('rejects wrong keyword', () => {
    expect(() => parsePayload('ALERT A3F2K9 4.90570 7.85370 12 ACC 2')).toThrow(PayloadError);
  });

  it('rejects unknown incident type', () => {
    expect(() => parsePayload('GERAS A3F2K9 4.90570 7.85370 12 XXX 2')).toThrow(PayloadError);
  });

  it('rejects severity out of range', () => {
    expect(() => parsePayload('GERAS A3F2K9 4.90570 7.85370 12 ACC 9')).toThrow(PayloadError);
  });

  it('rejects lat outside Nigeria bounds', () => {
    const throwsBounds = (t: string) => {
      try { parsePayload(t); return null; }
      catch (e) { return (e as PayloadError).code; }
    };
    expect(throwsBounds('GERAS A3F2K9 55.00000 7.85370 12 ACC 2')).toBe('lat_out_of_bounds');
    expect(throwsBounds('GERAS A3F2K9 1.00000 7.85370 12 ACC 2')).toBe('lat_out_of_bounds');
  });

  it('rejects lon outside Nigeria bounds', () => {
    try {
      parsePayload('GERAS A3F2K9 5.00000 20.00000 12 ACC 2');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as PayloadError).code).toBe('lon_out_of_bounds');
    }
  });

  it('rejects garbled text', () => {
    expect(() => parsePayload('help there was a crash on the highway')).toThrow(PayloadError);
    expect(() => parsePayload('')).toThrow(PayloadError);
  });

  it('round-trips: build then parse yields same fields', () => {
    const input = {
      ref: 'PQRSTV',
      lat: 6.12345,
      lon: 3.98765,
      accuracy_m: 33,
      incident_type: 'MED' as const,
      severity: 3 as const,
      reporter_phone: '+2348031234567',
    };
    const msg = buildPayload(input);
    const parsed = parsePayload(msg);
    expect(parsed).toEqual(input);
  });
});
