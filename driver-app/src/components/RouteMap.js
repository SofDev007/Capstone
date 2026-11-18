'use dom';
// Driver navigation map (MapLibre in an Expo DOM component; a webview on phones).
// Props are plain data; changing them updates the map in place (no reload / flicker).
// night: Night Glass dark map with a neon route. Driver safety: nothing on this map loops
// (no flow dashes, no pulsing rings) — only the bus marker moves, and only when the bus does.
import { useEffect, useRef, useState } from 'react';
import { MAP_STYLE_URL, MAP_STYLE_DARK_URL, INDIA_VIEW, loadMapLibre } from 'transit-shared/mapConfig.js';
import { applyNightGlassStyle, addNeonRouteLayers, injectNeonMapCss } from 'transit-shared/neonMap.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
let maplibregl; // set by loadMapLibre(); see mapConfig.js for why it isn't imported
const line = (coordinates, color) => (coordinates?.length > 1 ? { type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates } } : EMPTY);

export default function RouteMap({ path = [], stops = [], nextIndex = 0, position = null, detour = null, ink = '#17633F', stock = '#BFE6CF', night = false, follow = true, reduceMotion = false }) {
  const [ready, setReady] = useState(0);
  const el = useRef(null);
  const map = useRef(null);
  const loaded = useRef(false);
  const marker = useRef(null);
  const glide = useRef(0);
  const latest = useRef({});
  latest.current = { path, stops, nextIndex, detour, ink, position };

  // Night Glass palette (ink = the route's neon there).
  const c = night
    ? { surface: '#0E1424', passed: '#262E44', next: '#EAF0FF', label: '#9AA6C7', halo: '#04060C', detour: '#FFC857' }
    : { surface: '#FBFBF8', passed: '#C9CDC4', next: '#16213E', label: '#16213E', halo: '#FBFBF8', detour: '#7A5600' };

  const paint = () => {
    const m = map.current;
    if (!loaded.current) return;
    const s = latest.current;
    m.getSource('route').setData(line(s.path, s.ink));
    m.getSource('detour').setData(line(s.detour, c.detour));
    m.getSource('stops').setData({
      type: 'FeatureCollection',
      features: s.stops.map((stop, i) => ({
        type: 'Feature',
        properties: { name: stop.name, passed: i < s.nextIndex, next: i === s.nextIndex },
        geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] }
      }))
    });
    if (!night) m.setPaintProperty('route-line', 'line-color', s.ink);
    m.setPaintProperty('stops-circle', 'circle-stroke-color', ['case', ['get', 'next'], c.next, s.ink]);
  };

  useEffect(() => {
    let cancelled = false;
    loadMapLibre().then((lib) => {
      if (cancelled) return;
      maplibregl = lib;
      if (night) injectNeonMapCss();
      create();
      setReady((n) => n + 1);
    }).catch((e) => console.warn(e.message)); // offline: the map stays a plain background
    return () => { cancelled = true; map.current?.remove(); map.current = null; loaded.current = false; };
  }, [night]); // eslint-disable-line react-hooks/exhaustive-deps

  function create() {
    const m = new maplibregl.Map({
      container: el.current,
      style: night ? MAP_STYLE_DARK_URL : MAP_STYLE_URL,
      center: INDIA_VIEW.center,
      zoom: INDIA_VIEW.zoom,
      attributionControl: { compact: true }
    });
    map.current = m;
    marker.current = null; // a new map needs a new marker
    m.on('load', () => {
      m.addSource('route', { type: 'geojson', data: EMPTY });
      m.addSource('detour', { type: 'geojson', data: EMPTY });
      m.addSource('stops', { type: 'geojson', data: EMPTY });
      if (night) {
        applyNightGlassStyle(m);
        addNeonRouteLayers(m, 'route', { flow: false });
      } else {
        m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FBFBF8', 'line-width': 10 } });
        m.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ink, 'line-width': 6 } });
      }
      m.addLayer({ id: 'detour-line', type: 'line', source: 'detour', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.detour, 'line-width': night ? 4 : 6, 'line-dasharray': [1.2, 1] } });
      m.addLayer({ id: 'stops-circle', type: 'circle', source: 'stops', paint: {
        'circle-radius': ['case', ['get', 'next'], 9, 6.5],
        'circle-color': ['case', ['get', 'passed'], c.passed, c.surface],
        'circle-stroke-width': ['case', ['get', 'next'], 4, 3],
        'circle-stroke-color': ink
      } });
      m.addLayer({ id: 'stops-label', type: 'symbol', source: 'stops', minzoom: 12, layout: {
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 13, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true
      }, paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.6 } });
      loaded.current = true;
      paint();
      const s = latest.current;
      if (s.path.length > 1 && !s.position) {
        const b = s.path.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(s.path[0], s.path[0]));
        m.fitBounds(b, { padding: 40, duration: 0 });
      }
    });
  }

  useEffect(paint, [path, stops, nextIndex, detour, ink, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bus marker: glides between fixes; camera follows.
  useEffect(() => {
    const m = map.current;
    if (!m || !position) return;
    if (!marker.current) {
      const dot = document.createElement('div');
      dot.style.cssText = night
        ? `width:30px;height:30px;border-radius:50%;background:${ink};border:3px solid #FFFFFF;box-shadow:0 0 16px ${ink};display:grid;place-items:center;`
        : `width:30px;height:30px;border-radius:50%;background:#16213E;border:4px solid ${stock};box-shadow:0 4px 12px rgba(22,33,62,.45);display:grid;place-items:center;`;
      dot.innerHTML = `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid ${night ? '#04060C' : '#FBFBF8'};margin-top:-2px"></div>`;
      marker.current = new maplibregl.Marker({ element: dot, rotationAlignment: 'map' }).setLngLat([position.lng, position.lat]).addTo(m);
      m.jumpTo({ center: [position.lng, position.lat], zoom: 15.5 });
    }
    marker.current.setRotation(position.heading || 0);
    const from = marker.current.getLngLat().toArray();
    const to = [position.lng, position.lat];
    cancelAnimationFrame(glide.current);
    if (reduceMotion) {
      marker.current.setLngLat(to);
    } else {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / 900);
        const e = 1 - Math.pow(1 - t, 3);
        marker.current.setLngLat([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]);
        if (t < 1) glide.current = requestAnimationFrame(step);
      };
      glide.current = requestAnimationFrame(step);
    }
    if (follow) m.easeTo({ center: to, zoom: Math.max(m.getZoom(), 15), duration: reduceMotion ? 0 : 900, easing: (x) => 1 - Math.pow(1 - x, 3) });
  }, [position, follow, stock, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // absolute: fills the webview on phones, and the parent View on web (where DOM components render inline)
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={el} style={{ width: '100%', height: '100%', background: night ? '#0A0F1C' : '#E8EAE4' }} />
    </div>
  );
}
