import type { IncidentType, ParsedPayload, Severity } from './types';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REF_LEN = 6;

export const PAYLOAD_RE =
  /^GERAS\s+([0-9A-HJKMNP-TV-Z]{6})\s+(-?\d{1,3}\.\d{1,6})\s+(-?\d{1,3}\.\d{1,6})\s+(\d{1,4})\s+(ACC|MED|FIR|BRK|OBS)\s+([1-3])(?:\s+(\+?\d{10,14}))?\s*$/i;

const INCIDENT_TYPES = new Set<IncidentType>(['ACC', 'MED', 'FIR', 'BRK', 'OBS']);

export const NG_BOUNDS = { latMin: 4, latMax: 14, lonMin: 2, lonMax: 15 };

export class PayloadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function generateRef(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < REF_LEN; i++) {
    out += CROCKFORD[Math.floor(random() * CROCKFORD.length)];
  }
  return out;
}

function clampAccuracy(acc: number): number {
  if (!Number.isFinite(acc) || acc < 0) return 9999;
  return Math.min(9999, Math.round(acc));
}

function fmtCoord(n: number): string {
  return n.toFixed(5);
}

export interface BuildInput {
  ref: string;
  lat: number;
  lon: number;
  accuracy_m: number;
  incident_type: IncidentType;
  severity: Severity;
  reporter_phone?: string;
}

export function buildPayload(input: BuildInput): string {
  const { ref, lat, lon, accuracy_m, incident_type, severity, reporter_phone } = input;
  if (!/^[0-9A-HJKMNP-TV-Z]{6}$/i.test(ref)) {
    throw new PayloadError('bad_ref', 'ref must be 6 Crockford base32 chars');
  }
  if (!isFinite(lat) || !isFinite(lon)) {
    throw new PayloadError('bad_coords', 'lat/lon must be finite numbers');
  }
  if (!INCIDENT_TYPES.has(incident_type)) {
    throw new PayloadError('bad_type', `unknown incident_type: ${incident_type}`);
  }
  if (severity < 1 || severity > 3) {
    throw new PayloadError('bad_severity', 'severity must be 1..3');
  }
  const parts = [
    'GERAS',
    ref.toUpperCase(),
    fmtCoord(lat),
    fmtCoord(lon),
    clampAccuracy(accuracy_m).toString(),
    incident_type,
    severity.toString(),
  ];
  if (reporter_phone) {
    const cleaned = reporter_phone.replace(/\s+/g, '');
    if (!/^\+?\d{10,14}$/.test(cleaned)) {
      throw new PayloadError('bad_phone', 'phone must be 10-14 digits, optional leading +');
    }
    parts.push(cleaned);
  }
  const msg = parts.join(' ');
  if (msg.length > 160) {
    throw new PayloadError('too_long', `payload ${msg.length} chars > 160 GSM-7 limit`);
  }
  return msg;
}

export function parsePayload(text: string): ParsedPayload {
  if (typeof text !== 'string') {
    throw new PayloadError('not_string', 'payload must be a string');
  }
  const m = text.trim().match(PAYLOAD_RE);
  if (!m) {
    throw new PayloadError('malformed', 'payload does not match GERAS format');
  }
  const [, ref, latStr, lonStr, accStr, type, sevStr, phone] = m;
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  if (lat < NG_BOUNDS.latMin || lat > NG_BOUNDS.latMax) {
    throw new PayloadError('lat_out_of_bounds', `lat ${lat} outside Nigeria bounds`);
  }
  if (lon < NG_BOUNDS.lonMin || lon > NG_BOUNDS.lonMax) {
    throw new PayloadError('lon_out_of_bounds', `lon ${lon} outside Nigeria bounds`);
  }
  const parsed: ParsedPayload = {
    ref: ref.toUpperCase(),
    lat,
    lon,
    accuracy_m: parseInt(accStr, 10),
    incident_type: type.toUpperCase() as IncidentType,
    severity: parseInt(sevStr, 10) as Severity,
  };
  if (phone) parsed.reporter_phone = phone;
  return parsed;
}
