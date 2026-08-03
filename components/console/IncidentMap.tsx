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
  1: '#0ea5e9',
  2: '#f59e0b',
  3: '#ff2b2b',
};

// Diamond = SMS-origin, circle = HTTPS. Severity encoded by colour AND shape.
function iconFor(inc: Incident, selected: boolean): L.DivIcon {
  const isSms = inc.channel_first === 'sms';
  const fill = SEV_FILL[inc.severity as 1 | 2 | 3];
  const size = selected ? 24 : 18;
  const shape = isSms
    ? `<div style="width:${size}px;height:${size}px;background:${fill};transform:rotate(45deg);border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,.25);"></div>`
    : `<div style="width:${size}px;height:${size}px;background:${fill};border-radius:9999px;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,.25);"></div>`;
  const smsBadge = isSms
    ? `<span style="position:absolute;top:-8px;right:-8px;background:#7c3aed;color:#ffffff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:9999px;letter-spacing:.04em;">SMS</span>`
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
    // Cartodb Voyager — clean neutral basemap that reads well with red/amber markers.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap · &copy; CARTO',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [initialCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const store = markersRef.current;
    const nextIds = new Set(incidents.map((i) => i.id));

    for (const [id, marker] of store) {
      if (!nextIds.has(id)) {
        marker.remove();
        store.delete(id);
      }
    }

    for (const inc of incidents) {
      const selected = inc.id === selectedId;
      const existing = store.get(inc.id);
      if (existing) {
        existing.setLatLng([inc.lat, inc.lon]);
        existing.setIcon(iconFor(inc, selected));
        continue;
      }
      const marker = L.marker([inc.lat, inc.lon], { icon: iconFor(inc, selected), keyboard: true })
        .addTo(map)
        .on('click', () => onSelect(inc.id));
      store.set(inc.id, marker);

      if (!pulsedRef.current.has(inc.id)) {
        pulsedRef.current.add(inc.id);
        const el = marker.getElement();
        if (el) {
          el.style.transition = 'transform 350ms ease-out';
          el.style.transform = 'scale(1.6)';
          setTimeout(() => { el.style.transform = 'scale(1)'; }, 350);
        }
      }
    }
  }, [incidents, selectedId, onSelect]);

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
      className="absolute inset-0 bg-soft"
      style={{ minHeight: 240 }}
    />
  );
}
