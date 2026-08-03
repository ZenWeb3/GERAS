import type { IncidentType, Severity, Status } from './types';

export function coord(n: number): string {
  return n.toFixed(5);
}

export function ago(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export const severityLabel: Record<Severity, string> = {
  1: 'Minor',
  2: 'Serious',
  3: 'Critical',
};

export const severityColor: Record<Severity, string> = {
  1: 'text-minor border-minor/40 bg-minor/10',
  2: 'text-serious border-serious/40 bg-serious/10',
  3: 'text-critical border-critical/40 bg-critical/10',
};

export const typeLabel: Record<IncidentType, string> = {
  ACC: 'Crash',
  MED: 'Medical',
  FIR: 'Fire',
  BRK: 'Breakdown',
  OBS: 'Obstruction',
};

export const statusLabel: Record<Status, string> = {
  new: 'New',
  triaged: 'Triaged',
  dispatched: 'Dispatched',
  onscene: 'On scene',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};
