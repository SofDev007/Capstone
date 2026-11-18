// Night Glass map helpers for MapLibre, shared by the admin MapView and the apps' DOM map components
// (PassengerMap, RouteMap). Plain DOM + MapLibre API: no React, no imports of maplibre itself.
// See DESIGN.md › Night Glass for the visual spec.
import { buildPathIndex, projectOntoPath, pointAtDistance, subPath } from './geo.js';

const EMPTY = { type: 'FeatureCollection', features: [] };

// ─── Buses on their route ────────────────────────────────────────────────────────────────────
// A bus is drawn ON its route polyline: each GPS fix is projected onto the route and the marker moves
// by distance along it, so it follows every bend. A fix further than SNAP_METERS from the route is a
// bus that really is off its route; it is drawn at its raw GPS position (never hidden, never faked).
export const SNAP_METERS = 100;
const BACKTRACK_METERS = 50; // GPS jitter backwards; more than this = a new trip from the first stop
/** Content key of a route path ('' if none). DOM-component props arrive as new arrays, so compare these, not references. */
export const pathKey = (path) => (Array.isArray(path) && path.length > 1 ? `${path.length}|${path[0]}|${path[path.length - 1]}` : '');
const indexes = new Map(); // path key -> index
function indexFor(path) {
  const key = pathKey(path);
  if (!key) return null;
  let index = indexes.get(key);
  if (!index) {
    if (indexes.size > 64) indexes.clear();
    index = buildPathIndex(path);
    indexes.set(key, index);
  }
  return index;
}

/**
 * Where to draw a GPS fix [lng, lat] on `path`: { index, along, lngLat } on the route, or null when
 * the path is unknown or the fix is more than SNAP_METERS away. minAlong prefers forward matches
 * on routes that pass the same street twice.
 */
export function placeOnRoute(path, lngLat, minAlong = 0) {
  const index = indexFor(path);
  if (!index) return null;
  const hit = projectOntoPath(index, { lat: lngLat[1], lng: lngLat[0] }, Math.max(0, minAlong));
  if (!hit || hit.offset > SNAP_METERS) return null;
  const p = pointAtDistance(index, hit.along);
  return { index, along: hit.along, lngLat: [p.lng, p.lat] };
}

export const NIGHT_MAP = {
  bg: '#0A0F1C',
  land: '#0B1222',
  building: '#0D1424',
  water: '#081631', // deep navy
  roadMajor: '#131A2C',
  roadMinor: '#10172A',
  label: '#6F7B9C', // muted, ≥ 4:1 on bg
  halo: '#04060C'
};

export const prefersReducedMotion = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** Recolour the OpenFreeMap "dark" style to Night Glass. Call after the map's `load`. */
export function applyNightGlassStyle(map) {
  for (const { id, type } of map.getStyle().layers) {
    const set = (prop, value) => { try { map.setPaintProperty(id, prop, value); } catch { /* layer lacks prop */ } };
    if (type === 'background') set('background-color', NIGHT_MAP.bg);
    else if (id === 'water') set('fill-color', NIGHT_MAP.water);
    else if (id === 'waterway') set('line-color', NIGHT_MAP.water);
    else if (type === 'fill' && id.startsWith('building')) set('fill-color', NIGHT_MAP.building);
    else if (type === 'fill' && /landuse|landcover|aeroway|road_area/.test(id)) set('fill-color', NIGHT_MAP.land);
    else if (type === 'line' && /motorway|major|runway/.test(id)) set('line-color', NIGHT_MAP.roadMajor);
    else if (type === 'line' && /highway|road|aeroway|railway/.test(id)) set('line-color', NIGHT_MAP.roadMinor);
    else if (type === 'symbol') { set('text-color', NIGHT_MAP.label); set('text-halo-color', NIGHT_MAP.halo); set('icon-opacity', 0.5); }
  }
}

/**
 * Neon route lines from a line source whose features carry `color` (and optional `width`, `opacity`):
 * glow (width 8, blur 6, .75) → core (3.5, neon) → white flow dashes (animated by animateFlow).
 * Returns the flow layer id.
 */
export function addNeonRouteLayers(map, source, { id = source, filter, flow = true } = {}) {
  const f = filter ? { filter } : {};
  const layout = { 'line-cap': 'round', 'line-join': 'round' };
  const opacity = ['coalesce', ['get', 'opacity'], 1];
  const width = ['coalesce', ['get', 'width'], 3.5];
  map.addLayer({ id: `${id}-glow`, type: 'line', source, ...f, layout,
    paint: { 'line-color': ['get', 'color'], 'line-width': ['+', width, 4.5], 'line-blur': 6, 'line-opacity': ['*', 0.75, opacity] } });
  map.addLayer({ id: `${id}-core`, type: 'line', source, ...f, layout,
    paint: { 'line-color': ['get', 'color'], 'line-width': width, 'line-opacity': opacity } });
  if (!flow) return null;
  map.addLayer({ id: `${id}-flow`, type: 'line', source, ...f, layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#FFFFFF', 'line-width': 2, 'line-opacity': ['*', 0.7, opacity], 'line-dasharray': FLOW_STEPS[0] } });
  return `${id}-flow`;
}

// The MapLibre "animate a line" pattern: step through dash arrays that shift a 1-unit dash along a
// 9-unit period by half a unit each step (dashes are in line-width units: 2 px dots, 16 px gaps).
const DASH = 1;
const PERIOD = 9;
export const FLOW_STEPS = Array.from({ length: PERIOD * 2 }, (_, i) => {
  const o = i / 2;
  return o + DASH <= PERIOD ? [0, o, DASH, PERIOD - o - DASH] : [o + DASH - PERIOD, PERIOD - DASH, PERIOD - o, 0];
});

/** Animate flow layers. Off under reduced motion; paused while the tab is hidden. Returns stop(). */
export function animateFlow(map, layerIds, { reduceMotion = prefersReducedMotion() } = {}) {
  const ids = layerIds.filter(Boolean);
  if (reduceMotion || !ids.length) {
    ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', 'none'));
    return () => {};
  }
  let raf = 0;
  let step = -1;
  const tick = (ts) => {
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    const s = Math.floor(ts / 66) % FLOW_STEPS.length; // ~1.2 s per period, like the reference
    if (s === step) return;
    step = s;
    for (const id of ids) if (map.getLayer(id)) map.setPaintProperty(id, 'line-dasharray', FLOW_STEPS[s]);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

// ─── Bus markers ────────────────────────────────────────────────────────────────────────────
const CSS = `
.ng-bus{position:relative;width:28px;height:28px;display:grid;place-items:center;cursor:pointer;background:none;border:0;padding:0;--c:#3EE6FF}
.ng-bus .ng-core{width:14px;height:14px;border-radius:50%;background:var(--c);box-shadow:0 0 12px var(--c);display:grid;place-items:center;transition:transform .18s cubic-bezier(.16,1,.3,1)}
.ng-bus .ng-core::after{content:'';width:6px;height:6px;border-radius:50%;background:#fff}
.ng-bus .ng-ring{position:absolute;inset:4px;border-radius:50%;border:1.5px solid var(--c);animation:ng-pulse 1.6s ease-out infinite}
.ng-bus[data-pulse=false] .ng-ring,.ng-bus[data-stale=true] .ng-ring{display:none}
.ng-bus:hover .ng-core,.ng-bus[data-selected=true] .ng-core{transform:scale(1.3)}
.ng-bus[data-selected=true]::before{content:'';position:absolute;inset:-2px;border-radius:50%;border:2px solid #fff}
.ng-bus[data-alert=true]{--c:#FF4D6D}
.ng-bus[data-stale=true]{opacity:.5}
.ng-bus[data-dim=true]{opacity:.35}
@keyframes ng-pulse{from{transform:scale(.7);opacity:1}to{transform:scale(1.9);opacity:0}}
.ng-chip{position:absolute;left:50%;bottom:100%;transform:translate(-50%,-6px);padding:4px 10px;border-radius:12px;font:600 12px/1.3 'Space Grotesk','Anek Latin',system-ui,sans-serif;white-space:nowrap;color:#EAF0FF;
  background:rgba(22,30,52,.82);-webkit-backdrop-filter:blur(18px) saturate(150%);backdrop-filter:blur(18px) saturate(150%);border:1px solid rgba(255,255,255,.13);box-shadow:0 10px 20px -10px rgba(0,0,0,.7);pointer-events:none;transition:opacity .18s ease-out}
.ng-chip::after{content:'';position:absolute;left:50%;bottom:-5px;margin-left:-5px;border:5px solid transparent;border-bottom:0;border-top-color:rgba(22,30,52,.82)}
.ng-chip b{color:var(--c);font-weight:700}
.ng-chip[data-hidden=true]{opacity:0}
.chips-off .ng-chip{display:none}
.ng-me{width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #3EE6FF;box-shadow:0 0 12px #3EE6FF;position:relative}
.ng-me::before{content:'';position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px;border-radius:50%;background:rgba(62,230,255,.15);animation:ng-me 2s ease-out infinite}
@keyframes ng-me{from{transform:scale(.6);opacity:1}to{transform:scale(1.8);opacity:0}}
.ng-pin{font:700 12px 'Anek Latin',system-ui,sans-serif;color:#04060C;padding:3px 8px;border-radius:8px;transform:translateY(-4px);box-shadow:0 0 14px currentColor}
.maplibregl-ctrl-attrib,.maplibregl-ctrl-attrib-inner{background:rgba(22,30,52,.75)!important;color:#8B97B8}
.maplibregl-ctrl-attrib a{color:#9AA6C7!important}
@media (prefers-reduced-motion: reduce){.ng-bus .ng-ring,.ng-me::before{animation:none;display:none}}
.ng-still .ng-bus .ng-ring,.ng-still .ng-me::before{display:none}
`;

/** Add the marker/chip CSS to a document once (DOM components have their own document). */
export function injectNeonMapCss(doc = document) {
  if (doc.getElementById('ng-map-css')) return;
  const style = doc.createElement('style');
  style.id = 'ng-map-css';
  style.textContent = CSS;
  doc.head.append(style);
}

/** A neon bus dot: white core, pulsing ring, optional ETA chip above it. */
export function createBusMarkerEl(onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'ng-bus';
  el.innerHTML = '<span class="ng-ring"></span><span class="ng-core"></span>';
  if (onClick) el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return el;
}

/**
 * state: { color, label, selected, alert, stale, dim, pulse, chip: { route, minutes, priority } | null }
 * The chip reads "12 · 4 min" (route/bus label · minutes). Lower priority number = more important.
 */
export function updateBusMarkerEl(el, { color, label, selected, alert, stale, dim, pulse = true, chip }) {
  el.style.setProperty('--c', color || '#3EE6FF');
  el.setAttribute('aria-label', `Bus ${label}`);
  el.title = `Bus ${label}`;
  Object.assign(el.dataset, { selected: Boolean(selected), alert: Boolean(alert), stale: Boolean(stale), dim: Boolean(dim), pulse: Boolean(pulse) });
  let c = el.querySelector('.ng-chip');
  if (!chip) { c?.remove(); return; }
  if (!c) { c = document.createElement('span'); c.className = 'ng-chip'; el.append(c); }
  c.dataset.priority = chip.priority ?? 10;
  c.innerHTML = '';
  c.append(`${chip.route ?? label} · `);
  const b = document.createElement('b');
  b.textContent = chip.text;
  c.append(b);
}

/** Hide lower-priority ETA chips that overlap a more important one. Cheap: a few rects. */
export function layoutChips(container) {
  const chips = [...container.querySelectorAll('.ng-chip')]
    .sort((a, b) => Number(a.dataset.priority) - Number(b.dataset.priority));
  const placed = [];
  for (const c of chips) {
    c.dataset.hidden = 'false';
    const r = c.getBoundingClientRect();
    if (!r.width) continue; // display:none (zoomed out)
    const hit = placed.some((p) => r.left < p.right + 4 && r.right + 4 > p.left && r.top < p.bottom + 2 && r.bottom + 2 > p.top);
    if (hit) c.dataset.hidden = 'true';
    else placed.push(r);
  }
}

/** Re-run layoutChips on map movement and glides, at most every 120 ms. Returns stop(). */
export function watchChips(map) {
  let last = 0;
  let timer = 0;
  const run = () => { timer = 0; last = performance.now(); layoutChips(map.getContainer()); };
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(run, Math.max(0, 120 - (performance.now() - last)));
  };
  map.on('render', schedule);
  return () => { map.off('render', schedule); clearTimeout(timer); };
}

/**
 * Move a marker to the GPS fix `to` over `ms` (ease-out cubic); jumps under reduced motion.
 * With `path` (the bus's route), the marker is placed on the route and travels along it, following
 * every bend; a big step backwards (new trip) jumps instead of driving the route in reverse.
 * Without a path, or for a fix > SNAP_METERS off the route, it glides straight to the raw fix.
 * entry: { marker, raf, onRoute } (onRoute is kept up to date here).
 * onFrame(lngLat, onRoute) each step; onRoute = { index, along } or null.
 */
export function glideMarker(entry, to, { ms = 1000, reduceMotion = prefersReducedMotion(), onFrame, path } = {}) {
  cancelAnimationFrame(entry.raf);
  const prev = entry.onRoute;
  const pathIndex = indexFor(path);
  const sameRoute = Boolean(prev && pathIndex && prev.index === pathIndex);
  const dest = pathIndex ? placeOnRoute(path, to, sameRoute ? prev.along - BACKTRACK_METERS : 0) : null;

  if (dest) {
    const startAlong = sameRoute ? prev.along : placeOnRoute(path, entry.marker.getLngLat().toArray())?.along;
    if (reduceMotion || startAlong == null || dest.along < startAlong - BACKTRACK_METERS) {
      entry.onRoute = { index: dest.index, along: dest.along };
      entry.marker.setLngLat(dest.lngLat);
      onFrame?.(dest.lngLat, entry.onRoute);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const along = startAlong + (dest.along - startAlong) * (1 - Math.pow(1 - t, 3));
      const pt = pointAtDistance(dest.index, along);
      const p = [pt.lng, pt.lat];
      entry.onRoute = { index: dest.index, along };
      entry.marker.setLngLat(p);
      onFrame?.(p, entry.onRoute);
      if (t < 1) entry.raf = requestAnimationFrame(step);
    };
    entry.raf = requestAnimationFrame(step);
    return;
  }

  // Route not loaded yet, or the bus is genuinely off its route: show the raw fix.
  entry.onRoute = null;
  const from = entry.marker.getLngLat().toArray();
  if (reduceMotion) { entry.marker.setLngLat(to); onFrame?.(to, null); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const e = 1 - Math.pow(1 - t, 3);
    const p = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
    entry.marker.setLngLat(p);
    onFrame?.(p, null);
    if (t < 1) entry.raf = requestAnimationFrame(step);
  };
  entry.raf = requestAnimationFrame(step);
}

/** Initial marker position for a new bus: on its route when possible. Sets entry.onRoute. */
export function startOnRoute(entry, lngLat, path) {
  const at = placeOnRoute(path, lngLat);
  entry.onRoute = at && { index: at.index, along: at.along };
  return at ? at.lngLat : lngLat;
}

// ─── Light trails ──────────────────────────────────────────────────────────────────────────
/**
 * Each bus leaves a light trail drawn with a line-gradient (transparent → route colour):
 * on its route, the last `length` metres of the route behind the marker (so the trail bends with
 * the road); off its route, its last `max` GPS points + its current (gliding) position.
 * line-gradient can't be data-driven, so there is one layer per colour, created on first use.
 */
export function createTrails(map, { max = 12, length = 400, before } = {}) {
  const source = 'ng-trails';
  map.addSource(source, { type: 'geojson', lineMetrics: true, data: EMPTY });
  const buses = new Map(); // id -> { pts: [[lng,lat]], head: [lng,lat], color }
  const layers = new Set();
  let dirty = false;
  let last = 0;
  let raf = 0;

  const ensureLayer = (color) => {
    if (layers.has(color)) return;
    layers.add(color);
    const clear = `${color}00`;
    map.addLayer({
      id: `${source}-${color}`, type: 'line', source, filter: ['==', ['get', 'color'], color],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-width': 5, 'line-blur': 1, 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, clear, 1, color] }
    }, before && map.getLayer(before) ? before : undefined);
  };

  const render = () => {
    const features = [];
    for (const b of buses.values()) {
      const coords = b.onRoute
        ? subPath(b.onRoute.index, b.onRoute.along - length, b.onRoute.along)
        : [...b.pts, ...(b.head ? [b.head] : [])];
      if (coords.length < 2) continue;
      ensureLayer(b.color);
      features.push({ type: 'Feature', properties: { color: b.color }, geometry: { type: 'LineString', coordinates: coords } });
    }
    map.getSource(source)?.setData({ type: 'FeatureCollection', features });
  };
  const loop = (now) => {
    raf = 0;
    if (!dirty) return;
    if (now - last < 80) { raf = requestAnimationFrame(loop); return; } // ~12 fps is plenty for a trail
    dirty = false;
    last = now;
    render();
  };
  const touch = () => { dirty = true; if (!raf) raf = requestAnimationFrame(loop); };

  return {
    /** A new GPS fix for a bus (the fix it is gliding away from becomes part of the trail). */
    push(id, lngLat, color) {
      let b = buses.get(id);
      if (!b) buses.set(id, (b = { pts: [], target: null, head: lngLat, color }));
      b.color = color;
      if (b.target && (b.target[0] !== lngLat[0] || b.target[1] !== lngLat[1])) {
        b.pts.push(b.target); // the fix the marker is leaving becomes trail
        if (b.pts.length > max - 1) b.pts.shift();
      }
      b.target = lngLat;
      touch();
    },
    /** The marker's animated position (so the trail stays attached while it glides); onRoute from glideMarker. */
    head(id, lngLat, onRoute = null) {
      const b = buses.get(id);
      if (!b) return;
      if (b.onRoute && !onRoute) b.pts = []; // left the route: start a fresh GPS trail
      b.head = lngLat;
      b.onRoute = onRoute && { ...onRoute };
      touch();
    },
    remove(id) { if (buses.delete(id)) touch(); },
    clear() { buses.clear(); touch(); },
    stop() { cancelAnimationFrame(raf); }
  };
}
