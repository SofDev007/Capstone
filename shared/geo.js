// Geometry helpers shared by backend (ETA, off-route, journey planner) and apps (re-routing).
// Points are { lat, lng }. Paths are GeoJSON-style coordinate arrays: [[lng, lat], ...].

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in meters. */
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Local flat projection (meters) around refLat. Accurate to well under 1% at city scale.
function toXY(lat, lng, refLat) {
  return {
    x: toRad(lng) * EARTH_RADIUS_M * Math.cos(toRad(refLat)),
    y: toRad(lat) * EARTH_RADIUS_M,
  };
}

/**
 * Precompute cumulative distances along a path so projections are cheap.
 * Returns null for paths with fewer than 2 points.
 */
export function buildPathIndex(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const points = coordinates.map(([lng, lat]) => ({ lat, lng }));
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + haversine(points[i - 1], points[i]));
  }
  return { points, cumulative, total: cumulative[cumulative.length - 1] };
}

/**
 * Project a point onto a path.
 * Returns { along: meters from path start, offset: perpendicular distance in meters, segment }.
 * minAlong lets callers prefer progress-consistent matches on paths that double back
 * (segments that end before minAlong are skipped unless nothing else is within 100 m).
 */
export function projectOntoPath(index, point, minAlong = 0) {
  if (!index) return null;
  let best = null;
  let bestAny = null;
  for (let i = 0; i < index.points.length - 1; i++) {
    const a = index.points[i];
    const b = index.points[i + 1];
    const refLat = a.lat;
    const A = toXY(a.lat, a.lng, refLat);
    const B = toXY(b.lat, b.lng, refLat);
    const P = toXY(point.lat, point.lng, refLat);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq));
    const offset = Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy));
    const along = index.cumulative[i] + t * (index.cumulative[i + 1] - index.cumulative[i]);
    const candidate = { along, offset, segment: i };
    if (!bestAny || offset < bestAny.offset) bestAny = candidate;
    if (index.cumulative[i + 1] >= minAlong && (!best || offset < best.offset)) best = candidate;
  }
  // Prefer the forward match unless it is clearly worse than the global nearest one.
  if (best && (best.offset <= 100 || best.offset - bestAny.offset < 50)) return best;
  return bestAny;
}

/** The point `along` meters from the start of an indexed path. */
export function pointAtDistance(index, along) {
  if (!index) return null;
  const d = Math.max(0, Math.min(index.total, along));
  let i = 0;
  while (i < index.cumulative.length - 2 && index.cumulative[i + 1] < d) i++;
  const seg = index.cumulative[i + 1] - index.cumulative[i] || 1;
  const t = (d - index.cumulative[i]) / seg;
  const a = index.points[i];
  const b = index.points[i + 1];
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** The part of an indexed path between two distances along it (clamped), as [[lng, lat], ...]. */
export function subPath(index, from, to) {
  if (!index) return [];
  const a = Math.max(0, Math.min(from, to));
  const b = Math.min(index.total, Math.max(from, to));
  const start = pointAtDistance(index, a);
  const end = pointAtDistance(index, b);
  const out = [[start.lng, start.lat]];
  for (let i = 1; i < index.points.length - 1; i++) {
    if (index.cumulative[i] > a && index.cumulative[i] < b) out.push([index.points[i].lng, index.points[i].lat]);
  }
  out.push([end.lng, end.lat]);
  return out;
}

/** The part of a path between two points (e.g. boarding and alighting stops), as [[lng, lat], ...]. */
export function slicePath(coordinates, from, to) {
  const index = buildPathIndex(coordinates);
  if (!index) return [];
  const a = projectOntoPath(index, from);
  const b = projectOntoPath(index, to, a.along);
  if (b.along <= a.along) return [[from.lng, from.lat], [to.lng, to.lat]];
  const out = [[pointAtDistance(index, a.along).lng, pointAtDistance(index, a.along).lat]];
  for (let i = a.segment + 1; i <= b.segment; i++) out.push([index.points[i].lng, index.points[i].lat]);
  const end = pointAtDistance(index, b.along);
  out.push([end.lng, end.lat]);
  return out;
}

/** Shortest distance (meters) from a point to a path. */
export function distanceToPath(index, point) {
  return projectOntoPath(index, point)?.offset ?? Infinity;
}

/** Straight-line path through points, as [[lng, lat], ...]. */
export function straightPath(points) {
  return points.map((p) => [p.lng, p.lat]);
}

/** Walking time in minutes for a straight-line distance (1.3x detour factor, ~4.8 km/h). */
export function walkMinutes(meters) {
  return (meters * 1.3) / 80;
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
