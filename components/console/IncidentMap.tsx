'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Incident } from '@/lib/types';

interface Props {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const SEV_FILL: Record<1 | 2 | 3, string> = {
  1: '#38bdf8',
  2: '#ffb020',
  3: '#ff3b3b',
};

// Diamond for SMS-origin, circle for HTTPS. Severity encoded by colour AND
// shape so we never rely on colour alone (CLAUDE.md §6).
function iconFor(inc: Incident, selected: boolean): L.DivIcon {
  const isSms = inc.channel_first === 'sms';
  const fill = SEV_FILL[inc.severity as 1 | 2 | 3];
  const size = selected ? 22 : 16;
  const shape = isSms
    ? `<div style="width:${size}px;height:${size}px;background:${fill};transform:rotate(45deg);border:2px solid #0b1220;box-shadow:0 0 0 1px ${fill}66;"></div>`
    : `<div style="width:${size}px;height:${size}px;background:${fill};border-radius:9999px;border:2px solid #0b1220;box-shadow:0 0 0 1px ${fill}66;"></div>`;
  const smsBadge = isSms
    ? `<span style="position:absolute;top:-6px;right:-6px;background:#c084fc;color:#0b1220;font-size:8px;font-weight:700;padding:1px 3px;border-radius:3px;">SMS</span>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;">${shape}${smsBadge}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function IncidentMap({ incidents, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const pulsedRef = useRef<Set<string>>(new Set());

  const initialCenter = useMemo<[number, number]>(() => [5.05, 7.85], []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: 11,
      zoomControl: true,
      preferCanvas: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [initialCenter]);

  // Reconcile markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const store = markersRef.current;
    const nextIds = new Set(incidents.map((i) => i.id));

    // remove gone
    for (const [id, marker] of store) {
      if (!nextIds.has(id)) {
        marker.remove();
        store.delete(id);
      }
    }

    // add / update
    for (const inc of incidents) {
      const selected = inc.id === selectedId;
      const existing = store.get(inc.id);
      if (existing) {
        existing.setLatLng([inc.lat, inc.lon]);
        existing.setIcon(iconFor(inc, selected));
        continue;
      }
      const marker = L.marker([inc.lat, inc.lon], {
        icon: iconFor(inc, selected),
        keyboard: true,
      })
        .addTo(map)
        .on('click', () => onSelect(inc.id));
      store.set(inc.id, marker);

      // Pulse the first time we see it.
      if (!pulsedRef.current.has(inc.id)) {
        pulsedRef.current.add(inc.id);
        const el = marker.getElement();
        if (el) {
          el.style.transition = 'transform 350ms ease-out';
          el.style.transform = 'scale(1.6)';
          setTimeout(() => {
            el.style.transform = 'scale(1)';
          }, 350);
        }
      }
    }
  }, [incidents, selectedId, onSelect]);

  // Fly to selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const inc = incidents.find((i) => i.id === selectedId);
    if (!inc) return;
    map.flyTo([inc.lat, inc.lon], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [selectedId, incidents]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-ground"
      style={{ minHeight: 240 }}
    />
  );
}
