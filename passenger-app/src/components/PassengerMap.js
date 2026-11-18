'use dom';
// Passenger map (MapLibre in an Expo DOM component). Everything is plain data so updates are in place.
//   buses:  [{ id, lat, lng, label, stock, color, selected, dim, path, chip: { route, text, priority } | null }]
//           path = the bus's route polyline: the marker is drawn on it and moves along it (neonMap.glideMarker)
//   lines:  [{ id, coordinates, color, dashed, width }]   route segments and walking legs
//   stops:  [{ id, lat, lng, name, color, big }]
//   me:     { lat, lng } | null       from / to: { lat, lng } | null
//   fitKey: changes -> fit everything in view;  locateKey: changes -> fly to `me`
//   night:  Night Glass (dark neon map) instead of Ticket Stock (light);  reduceMotion: from the OS
import { useEffect, useRef, useState } from 'react';
import { MAP_STYLE_URL, MAP_STYLE_DARK_URL, INDIA_VIEW, loadMapLibre } from 'transit-shared/mapConfig.js';
import {
  applyNightGlassStyle, addNeonRouteLayers, animateFlow, injectNeonMapCss, createBusMarkerEl, updateBusMarkerEl,
  glideMarker, startOnRoute, pathKey, createTrails, watchChips
} from 'transit-shared/neonMap.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const GLIDE = 1000;
let maplibregl; // set by loadMapLibre(); see mapConfig.js for why it isn't imported

export default function PassengerMap({ buses = [], lines = [], stops = [], me = null, from = null, to = null, fitKey = '', locateKey = 0, padding = null, night = false, reduceMotion = false, onBusPress, onStopPress }) {
  const [ready, setReady] = useState(0);
  const el = useRef(null);
  const map = useRef(null);
  const loaded = useRef(false);
  const markers = useRef(new Map());
  const pins = useRef({});
  const trails = useRef(null);
  const latest = useRef({});
  latest.current = { lines, stops, buses, me, from, to, padding };

  const paintLayers = () => {
    const m = map.current;
    if (!loaded.current) return;
    const s = latest.current;
    m.getSource('lines').setData({
      type: 'FeatureCollection',
      features: s.lines.filter((l) => l.coordinates?.length > 1).map((l) => ({
        type: 'Feature', properties: { color: l.color, width: night ? Math.min(l.width || 3.5, 4.5) : l.width || 5, dashed: Boolean(l.dashed) },
        geometry: { type: 'LineString', coordinates: l.coordinates }
      }))
    });
    m.getSource('stops').setData({
      type: 'FeatureCollection',
      features: s.stops.map((st) => ({ type: 'Feature', properties: { id: st.id, name: st.name, color: st.color || '#16213E', big: Boolean(st.big) }, geometry: { type: 'Point', coordinates: [st.lng, st.lat] } }))
    });
  };

  const fit = () => {
    const m = map.current;
    const s = latest.current;
    const pts = [
      ...s.lines.flatMap((l) => l.coordinates || []),
      ...s.stops.map((st) => [st.lng, st.lat]),
      // `me` only matters when the trip starts at the current location (from == null);
      // otherwise a far-away phone position would zoom the map out to the whole country.
      ...[s.from ? null : s.me, s.from, s.to].filter(Boolean).map((p) => [p.lng, p.lat]),
      ...(s.lines.length ? [] : s.buses.map((b) => [b.lng, b.lat]))
    ];
    if (!pts.length) return;
    const bounds = pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
    m.fitBounds(bounds, { padding: s.padding || 60, maxZoom: 15.5, duration: reduceMotion ? 0 : 800 });
  };

  // (Re)create the map when the theme changes: the two styles have different base layers.
  useEffect(() => {
    let m;
    let cancelled = false;
    let stopFlow = () => {};
    let stopChips = () => {};
    loadMapLibre().then((lib) => {
      if (cancelled) return;
      maplibregl = lib;
      if (night) injectNeonMapCss();
      m = new maplibregl.Map({ container: el.current, style: night ? MAP_STYLE_DARK_URL : MAP_STYLE_URL, center: INDIA_VIEW.center, zoom: INDIA_VIEW.zoom, attributionControl: { compact: true } });
      map.current = m;
      markers.current = new Map();
      pins.current = {};
      m.on('load', () => {
        m.addSource('lines', { type: 'geojson', data: EMPTY });
        m.addSource('stops', { type: 'geojson', data: EMPTY });
        if (night) {
          applyNightGlassStyle(m);
          const flow = addNeonRouteLayers(m, 'lines', { id: 'lines-neon', filter: ['!', ['get', 'dashed']] });
          m.addLayer({ id: 'lines-dashed', type: 'line', source: 'lines', filter: ['get', 'dashed'], layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [0.5, 1.6] } });
          stopFlow = animateFlow(m, [flow], { reduceMotion });
          stopChips = watchChips(m);
          trails.current = createTrails(m);
          for (const [id, e] of markers.current) {
            trails.current.push(id, e.marker.getLngLat().toArray(), e.color);
            trails.current.head(id, e.marker.getLngLat().toArray(), e.onRoute);
          }
          m.addLayer({ id: 'stops-circle', type: 'circle', source: 'stops', paint: {
            'circle-radius': ['case', ['get', 'big'], 7, 5], 'circle-color': '#0E1424',
            'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': ['case', ['get', 'big'], 3, 2]
          } });
          m.addLayer({ id: 'stops-label', type: 'symbol', source: 'stops', minzoom: 12.5, layout: {
            'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12.5, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true
          }, paint: { 'text-color': '#9AA6C7', 'text-halo-color': '#04060C', 'text-halo-width': 1.6 } });
        } else {
          m.addLayer({ id: 'lines-casing', type: 'line', source: 'lines', filter: ['!', ['get', 'dashed']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FBFBF8', 'line-width': ['+', ['get', 'width'], 4] } });
          m.addLayer({ id: 'lines-solid', type: 'line', source: 'lines', filter: ['!', ['get', 'dashed']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'] } });
          m.addLayer({ id: 'lines-dashed', type: 'line', source: 'lines', filter: ['get', 'dashed'], layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-dasharray': [0.5, 1.6] } });
          m.addLayer({ id: 'stops-circle', type: 'circle', source: 'stops', paint: {
            'circle-radius': ['case', ['get', 'big'], 8, 5.5], 'circle-color': '#FBFBF8',
            'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': ['case', ['get', 'big'], 3.5, 2.5]
          } });
          m.addLayer({ id: 'stops-label', type: 'symbol', source: 'stops', minzoom: 12.5, layout: {
            'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12.5, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true
          }, paint: { 'text-color': '#16213E', 'text-halo-color': '#FBFBF8', 'text-halo-width': 1.6 } });
        }
        m.on('click', 'stops-circle', (e) => onStopPress?.(e.features[0].properties.id));
        m.on('mouseenter', 'stops-circle', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'stops-circle', () => { m.getCanvas().style.cursor = ''; });
        loaded.current = true;
        paintLayers();
        fit();
        setReady((n) => n + 1); // re-place markers/trails on the new map
      });
      setReady((n) => n + 1);
    }).catch((e) => console.warn(e.message)); // offline: the map stays a plain background
    return () => {
      cancelled = true;
      stopFlow();
      stopChips();
      trails.current?.stop();
      trails.current = null;
      m?.remove();
      map.current = null;
      loaded.current = false;
    };
  }, [night, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(paintLayers, [lines, stops]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded.current) fit(); }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = map.current;
    if (locateKey && m && me) m.flyTo({ center: [me.lng, me.lat], zoom: Math.max(m.getZoom(), 15), duration: reduceMotion ? 0 : 900 });
  }, [locateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bus markers: light = ticket-like labels; night = neon dots with trails and ETA chips. Both glide.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set();
    for (const b of buses) {
      if (b.lat == null) continue;
      seen.add(b.id);
      let entry = markers.current.get(b.id);
      if (!entry) {
        let node;
        let face;
        if (night) {
          node = createBusMarkerEl(() => onBusPress?.(entry.id));
        } else {
          // MapLibre positions a marker with `transform` on its element, so the label's scale/transition
          // live on an inner face; styling the element itself would knock the marker off its position.
          node = document.createElement('button');
          node.style.cssText = 'background:none;border:0;padding:0;cursor:pointer;';
          face = document.createElement('span');
          face.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;font:800 14px "Anek Latin",system-ui,sans-serif;font-variant-numeric:tabular-nums;min-width:34px;height:26px;padding:0 6px;border-radius:6px;box-shadow:0 4px 10px -4px rgba(22,33,62,.5);transition:transform .18s cubic-bezier(.16,1,.3,1),opacity .2s;';
          node.append(face);
          node.addEventListener('click', (e) => { e.stopPropagation(); onBusPress?.(entry.id); });
        }
        entry = { id: b.id, node, face, raf: 0, pos: [b.lng, b.lat], pathKey: pathKey(b.path) };
        entry.marker = new maplibregl.Marker({ element: node }).setLngLat(startOnRoute(entry, entry.pos, b.path)).addTo(m);
        markers.current.set(b.id, entry);
        if (night) {
          trails.current?.push(b.id, entry.pos, b.color);
          trails.current?.head(b.id, entry.marker.getLngLat().toArray(), entry.onRoute);
        }
      }
      const { node, face } = entry;
      entry.color = b.color;
      if (night) {
        updateBusMarkerEl(node, { color: b.color, label: b.label, selected: b.selected, dim: b.dim, chip: b.chip });
      } else {
        face.textContent = b.label;
        face.style.background = '#16213E';
        face.style.color = '#FBFBF8';
        face.style.border = `2px solid ${b.stock || '#BFE6CF'}`;
        face.style.transform = b.selected ? 'scale(1.18)' : 'scale(1)';
        face.style.opacity = b.dim ? '0.35' : '1';
      }
      node.style.zIndex = b.selected ? '3' : '2';
      // Compare with the last GPS fix (not the drawn position, which sits on the route line).
      const to = [b.lng, b.lat];
      const key = pathKey(b.path);
      const pathChanged = key !== entry.pathKey; // e.g. the route geometry arrived after the bus
      if (to[0] !== entry.pos[0] || to[1] !== entry.pos[1] || pathChanged) {
        entry.pos = to;
        entry.pathKey = key;
        if (night) trails.current?.push(b.id, to, b.color);
        glideMarker(entry, to, { ms: GLIDE, reduceMotion, path: b.path, onFrame: night ? (p, onRoute) => trails.current?.head(b.id, p, onRoute) : undefined });
      }
    }
    for (const [id, entry] of markers.current) {
      if (!seen.has(id)) { cancelAnimationFrame(entry.raf); entry.marker.remove(); markers.current.delete(id); trails.current?.remove(id); }
    }
  }, [buses, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Me (pulsing dot) and from/to pins
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const place = (key, point, make) => {
      if (!point) { pins.current[key]?.remove(); delete pins.current[key]; return; }
      if (!pins.current[key]) pins.current[key] = new maplibregl.Marker({ element: make(), anchor: key === 'me' ? 'center' : 'bottom' }).setLngLat([point.lng, point.lat]).addTo(m);
      else pins.current[key].setLngLat([point.lng, point.lat]);
    };
    place('me', me, () => {
      const d = document.createElement('div');
      if (night) d.className = 'ng-me';
      else d.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#1D4F8F;border:3px solid #FBFBF8;box-shadow:0 0 0 6px rgba(29,79,143,.18);';
      return d;
    });
    const pin = (label, bg) => () => {
      const d = document.createElement('div');
      if (night) {
        d.className = 'ng-pin';
        d.style.background = bg;
        d.style.color = '#04060C';
      } else {
        d.style.cssText = `font:700 12px "Anek Latin",system-ui,sans-serif;background:${bg};color:#FBFBF8;padding:3px 8px;border-radius:4px;box-shadow:0 4px 10px -4px rgba(22,33,62,.5);transform:translateY(-4px);`;
      }
      d.textContent = label;
      return d;
    };
    place('from', from, pin('A', night ? '#3EE6FF' : '#16213E'));
    place('to', to, pin('B', night ? '#FF6BD6' : '#A3184A'));
  }, [me, from, to, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // isolation: marker z-indexes stay inside the map (on web the DOM component shares the page)
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      <div ref={el} className={reduceMotion ? 'ng-still' : undefined} style={{ width: '100%', height: '100%', background: night ? '#0A0F1C' : '#E8EAE4' }} />
    </div>
  );
}
