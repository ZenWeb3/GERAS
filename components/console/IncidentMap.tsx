'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ago, coord, severityLabel, statusLabel, typeLabel } from '@/lib/format';
import type { Incident } from '@/lib/types';

interface Props {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function tooltipHtml(inc: Incident): string {
  const sev = inc.severity as 1 | 2 | 3;
  const sevColor = SEV_FILL[sev];
  const isSms = inc.channel_first === 'sms';
  return `
    <div style="font-family: Inter, system-ui, sans-serif; min-width: 180px;">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
        <span style="width:8px;height:8px;border-radius:9999px;background:${sevColor};display:inline-block;"></span>
        <strong style="font-size:13px;color:#0a0a0a;">${escapeHtml(typeLabel[inc.incident_type])}</strong>
        <span style="color:#6b7280;font-size:11px;">·</span>
        <span style="color:#6b7280;font-size:11px;">${escapeHtml(severityLabel[sev])}</span>
        ${isSms ? '<span style="margin-left:auto;background:#7c3aed;color:#fff;font-size:9px;padding:1px 5px;border-radius:9999px;font-weight:700;letter-spacing:.04em;">SMS</span>' : ''}
      </div>
      <div style="font-family: ui-monospace, monospace; font-size:11px; color:#3f3f46; margin-bottom:2px;">
        ${escapeHtml(inc.ref)} · ${coord(inc.lat)}, ${coord(inc.lon)}
      </div>
      <div style="font-size:11px; color:#6b7280;">
        ${escapeHtml(statusLabel[inc.status])} · ${escapeHtml(ago(inc.server_ts))} ago
      </div>
    </div>
  `;
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
    const el = containerRef.current;
    const map = L.map(el, {
      center: initialCenter,
      zoom: 11,
      zoomControl: false, // we re-add it in the bottom-right for reach on mobile
      preferCanvas: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      dragging: true,
      keyboard: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelDebounceTime: 40,
      wheelPxPerZoomLevel: 90,
      inertia: true,
      worldCopyJump: true,
      minZoom: 5,
      maxZoom: 18,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // "Fit to incidents" button — one-click zoom-to-all.
    const FitControl = L.Control.extend({
      onAdd() {
        const btn = L.DomUtil.create('a', 'leaflet-bar');
        btn.href = '#';
        btn.title = 'Fit to all incidents';
        btn.setAttribute('aria-label', 'Fit to all incidents');
        btn.style.cssText =
          'display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:#fff;color:#0a0a0a;text-decoration:none;font-weight:700;';
        btn.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4"/></svg>';
        L.DomEvent.on(btn, 'click', (e: Event) => {
          L.DomEvent.preventDefault(e);
          const bounds: L.LatLngBounds[] = [];
          markersRef.current.forEach((m) => bounds.push(m.getLatLng().toBounds(1)));
          if (bounds.length === 0) {
            map.setView(initialCenter, 11);
            return;
          }
          const combined = bounds.reduce((acc, b) => acc.extend(b));
          map.fitBounds(combined, { padding: [40, 40], maxZoom: 14 });
        });
        return btn;
      },
    });
    new FitControl({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap · &copy; CARTO',
    }).addTo(map);
    mapRef.current = map;

    // Leaflet reads container size at construction. If the parent hadn't
    // finished laying out yet (common with dynamic imports + flex layouts),
    // tiles cover the wrong bounds and the map appears zoomed out. Force a
    // resync now and whenever the container resizes.
    const nudge = () => {
      map.invalidateSize({ pan: false });
      // If the map still thinks the container is tiny, recenter at the intended zoom.
      const size = map.getSize();
      if (size.x < 200 || size.y < 200) return;
      map.setView(initialCenter, 11, { animate: false });
    };
    requestAnimationFrame(nudge);
    setTimeout(nudge, 200);

    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(el);

    return () => {
      ro.disconnect();
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
        existing.setTooltipContent(tooltipHtml(inc));
        continue;
      }
      const marker = L.marker([inc.lat, inc.lon], { icon: iconFor(inc, selected), keyboard: true })
        .addTo(map)
        .bindTooltip(tooltipHtml(inc), {
          direction: 'top',
          offset: [0, -6],
          opacity: 1,
          className: 'geras-tip',
        })
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
