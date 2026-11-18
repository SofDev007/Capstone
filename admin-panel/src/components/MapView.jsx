// Night Glass map (MapLibre, OpenFreeMap "dark" recoloured). Routes are neon GeoJSON lines (glow +
// core + animated flow); buses are neon HTML markers that glide between GPS points (1 s) and leave a
// light trail; optional ETA chips float above them at zoom ≥ chipMinZoom.
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_DARK_URL, INDIA_VIEW } from '@shared/mapConfig.js';
import { neon, glass } from '@shared/theme/tokens.js';
import {
  applyNightGlassStyle, addNeonRouteLayers, animateFlow, injectNeonMapCss, createBusMarkerEl, updateBusMarkerEl,
  glideMarker, createTrails, watchChips, prefersReducedMotion
} from '@shared/neonMap.js';
import { cn } from '@/lib/utils';

// MapLibre 6 runs tile parsing in a module worker; point it at the bundled file explicitly
// (Vite's dependency pre-bundling otherwise breaks the worker URL).
maplibregl.setWorkerUrl(maplibreWorkerUrl);

const EMPTY = { type: 'FeatureCollection', features: [] };
const GLIDE_MS = 1000;

const routesGeoJSON = (routes = []) => ({
  type: 'FeatureCollection',
  features: routes.filter((r) => r.coordinates?.length >= 2).map((r) => ({
    type: 'Feature',
    properties: { id: r.id, color: r.color || neon.cyan, width: r.highlighted ? 5 : 3.5, opacity: r.dimmed ? 0.3 : 1 },
    geometry: { type: 'LineString', coordinates: r.coordinates }
  }))
});

const stopsGeoJSON = (stops = []) => ({
  type: 'FeatureCollection',
  features: stops.map((s) => ({
    type: 'Feature',
    properties: { id: s.id, name: s.name, color: s.color || glass.text.muted, highlighted: Boolean(s.highlighted), label: s.label ?? '' },
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] }
  }))
});

function addLayers(map) {
  applyNightGlassStyle(map);
  map.addSource('routes', { type: 'geojson', data: EMPTY });
  map.addSource('stops', { type: 'geojson', data: EMPTY });
  map.addSource('trail', { type: 'geojson', data: EMPTY });
  const flow = addNeonRouteLayers(map, 'routes');
  map.addLayer({ id: 'trail-line', type: 'line', source: 'trail', layout: { 'line-cap': 'round' },
    paint: { 'line-color': neon.alert, 'line-width': 3, 'line-dasharray': [1.5, 1.5] } });
  // Stops: dark dot with a neon ring.
  map.addLayer({ id: 'stops-circle', type: 'circle', source: 'stops',
    paint: {
      'circle-radius': ['case', ['get', 'highlighted'], 7, 5],
      'circle-color': glass.bg.raised,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': ['case', ['get', 'highlighted'], 3, 2]
    } });
  map.addLayer({ id: 'stops-label', type: 'symbol', source: 'stops', minzoom: 12.5,
    layout: {
      'text-field': ['case', ['!=', ['get', 'label'], ''], ['get', 'label'], ['get', 'name']],
      'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true
    },
    paint: { 'text-color': glass.text.secondary, 'text-halo-color': glass.bg.deep, 'text-halo-width': 1.5 } });
  return flow;
}

export default function MapView({
  routes, stops, buses = [], incidents = [], trail,
  fitKey, fitPadding = 60, onBusClick, onStopClick, onMapClick, onMap, className, interactiveStops = true, chipMinZoom = 14
}) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const loaded = useRef(false);
  const busMarkers = useRef(new Map());
  const incidentMarkers = useRef(new Map());
  const trails = useRef(null);
  const handlers = useRef({});
  handlers.current = { onBusClick, onStopClick, onMapClick };
  const latest = useRef({});
  latest.current = { routes, stops, trail, buses };

  // Create the map once.
  useEffect(() => {
    injectNeonMapCss();
    const map = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_DARK_URL,
      center: INDIA_VIEW.center,
      zoom: INDIA_VIEW.zoom,
      attributionControl: { compact: true }
    });
    mapRef.current = map;
    onMap?.(map);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    let stopFlow = () => {};
    let stopChips = () => {};
    const zoomClass = () => container.current?.classList.toggle('chips-off', map.getZoom() < chipMinZoom);
    map.on('zoom', zoomClass);
    zoomClass();
    map.on('load', () => {
      const flow = addLayers(map);
      stopFlow = animateFlow(map, [flow]);
      stopChips = watchChips(map);
      trails.current = createTrails(map, { before: 'stops-circle' });
      loaded.current = true;
      const { routes: r, stops: s, trail: t } = latest.current;
      map.getSource('routes').setData(routesGeoJSON(r));
      map.getSource('stops').setData(stopsGeoJSON(s));
      map.getSource('trail').setData(t?.length > 1 ? { type: 'Feature', geometry: { type: 'LineString', coordinates: t } } : EMPTY);
      for (const [id, e] of busMarkers.current) trails.current.push(id, e.pos, e.color);
      map.fire('data-ready');
    });
    map.on('click', (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: loaded.current ? ['stops-circle'] : [] })[0];
      if (hit && handlers.current.onStopClick) handlers.current.onStopClick(hit.properties.id);
      else handlers.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    map.on('mousemove', (e) => {
      if (!loaded.current) return;
      const over = interactiveStops && map.queryRenderedFeatures(e.point, { layers: ['stops-circle'] }).length > 0;
      map.getCanvas().style.cursor = over ? 'pointer' : handlers.current.onMapClick ? 'crosshair' : '';
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container.current);
    return () => {
      ro.disconnect();
      stopFlow();
      stopChips();
      trails.current?.stop();
      trails.current = null;
      map.remove();
      loaded.current = false;
      busMarkers.current.clear();
      incidentMarkers.current.clear();
    };
  }, [interactiveStops]); // eslint-disable-line react-hooks/exhaustive-deps

  // GeoJSON layers
  useEffect(() => {
    if (loaded.current) mapRef.current.getSource('routes').setData(routesGeoJSON(routes));
  }, [routes]);
  useEffect(() => {
    if (loaded.current) mapRef.current.getSource('stops').setData(stopsGeoJSON(stops));
  }, [stops]);
  useEffect(() => {
    if (loaded.current) {
      mapRef.current.getSource('trail').setData(trail?.length > 1 ? { type: 'Feature', geometry: { type: 'LineString', coordinates: trail } } : EMPTY);
    }
  }, [trail]);

  // Neon bus markers: glide between positions, leave a light trail.
  useEffect(() => {
    const map = mapRef.current;
    const seen = new Set();
    for (const bus of buses) {
      if (bus.lat == null || bus.lng == null) continue;
      seen.add(bus.id);
      let entry = busMarkers.current.get(bus.id);
      if (!entry) {
        const el = createBusMarkerEl(() => handlers.current.onBusClick?.(entry.id));
        const marker = new maplibregl.Marker({ element: el }).setLngLat([bus.lng, bus.lat]).addTo(map);
        entry = { id: bus.id, el, marker, pos: [bus.lng, bus.lat], raf: 0, color: bus.color };
        busMarkers.current.set(bus.id, entry);
        trails.current?.push(bus.id, entry.pos, bus.color || neon.cyan);
      }
      const color = bus.alert ? neon.alert : bus.color || neon.cyan;
      entry.color = color;
      updateBusMarkerEl(entry.el, { color, label: bus.label, selected: bus.selected, alert: bus.alert, stale: bus.stale, chip: bus.chip });
      entry.marker.getElement().style.zIndex = bus.selected || bus.alert ? '3' : '2';

      const target = [bus.lng, bus.lat];
      if (target[0] !== entry.pos[0] || target[1] !== entry.pos[1]) {
        entry.pos = target;
        trails.current?.push(bus.id, target, color);
        glideMarker(entry, target, { ms: GLIDE_MS, onFrame: (p) => trails.current?.head(bus.id, p) });
      }
    }
    for (const [id, entry] of busMarkers.current) {
      if (!seen.has(id)) {
        cancelAnimationFrame(entry.raf);
        entry.marker.remove();
        busMarkers.current.delete(id);
        trails.current?.remove(id);
      }
    }
  }, [buses]);

  // Incident markers (pulsing) with SOS ripple rings
  useEffect(() => {
    const map = mapRef.current;
    const seen = new Set();
    for (const inc of incidents) {
      if (inc.lat == null) continue;
      seen.add(inc.id);
      let entry = incidentMarkers.current.get(inc.id);
      if (!entry) {
        const el = document.createElement('div');
        el.className = 'sos-ripple';
        el.innerHTML = '<span></span><span></span><span></span><div class="incident-marker" style="position:absolute;left:-11px;top:-11px"></div>';
        el.title = inc.title || 'Incident';
        entry = { marker: new maplibregl.Marker({ element: el }).setLngLat([inc.lng, inc.lat]).addTo(map) };
        incidentMarkers.current.set(inc.id, entry);
      }
      entry.marker.setLngLat([inc.lng, inc.lat]);
    }
    for (const [id, entry] of incidentMarkers.current) {
      if (!seen.has(id)) { entry.marker.remove(); incidentMarkers.current.delete(id); }
    }
  }, [incidents]);

  // Fit to everything shown when fitKey changes.
  useEffect(() => {
    if (fitKey === undefined) return;
    const map = mapRef.current;
    const fit = () => {
      const pts = [
        ...(routes || []).flatMap((r) => r.coordinates || []),
        ...(stops || []).map((s) => [s.lng, s.lat]),
        ...buses.filter((b) => b.lat != null).map((b) => [b.lng, b.lat]),
        ...incidents.filter((i) => i.lat != null).map((i) => [i.lng, i.lat]),
        ...(trail || [])
      ];
      if (!pts.length) return;
      const bounds = pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
      map.fitBounds(bounds, { padding: fitPadding, maxZoom: 15, duration: prefersReducedMotion() ? 0 : 900 });
    };
    if (loaded.current) fit();
    else map.once('data-ready', fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={container} className={cn('w-full h-full bg-paper', className)} />;
}
