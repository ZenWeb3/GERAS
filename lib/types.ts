export type IncidentType = 'ACC' | 'MED' | 'FIR' | 'BRK' | 'OBS';
export type Severity = 1 | 2 | 3;
export type Channel = 'https' | 'sms';
export type Status = 'new' | 'triaged' | 'dispatched' | 'onscene' | 'resolved' | 'cancelled';

export const INCIDENT_TYPES: Record<IncidentType, string> = {
  ACC: 'Crash',
  MED: 'Medical',
  FIR: 'Fire',
  BRK: 'Breakdown',
  OBS: 'Obstruction',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  1: 'Minor',
  2: 'Serious',
  3: 'Critical',
};

export interface ParsedPayload {
  ref: string;
  lat: number;
  lon: number;
  accuracy_m: number;
  incident_type: IncidentType;
  severity: Severity;
  reporter_phone?: string;
}

export interface Incident {
  id: string;
  ref: string;
  lat: number;
  lon: number;
  accuracy_m: number | null;
  incident_type: IncidentType;
  severity: Severity;
  reporter_phone: string | null;
  device_id: string | null;
  channel_first: Channel;
  channels_seen: Channel[];
  client_ts: string | null;
  server_ts: string;
  status: Status;
  assigned_unit_id: string | null;
  notes: string | null;
}

export interface PatrolUnit {
  id: string;
  callsign: string;
  station: string;
  phone: string;
  lat: number;
  lon: number;
  status: 'available' | 'dispatched' | 'onscene' | 'offline';
  last_seen: string;
}
