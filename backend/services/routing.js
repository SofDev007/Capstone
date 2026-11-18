// Road routing (OpenRouteService) and place search (Photon), proxied so API keys stay on the server.
// Both degrade gracefully: no ORS key -> straight lines between points; Photon down -> no places.
import { haversine, straightPath } from '../../shared/geo.js';

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const INDIA_BBOX = '68.1,6.5,97.5,35.7';
const USER_AGENT = 'TransitTracker/1.0 (bus tracking app)';
const ORS_MAX_WAYPOINTS = 50;
const SNAP_RADIUS_M = 1000;
const FALLBACK_SPEED_MS = 5.5; // ~20 km/h city bus
const DETOUR = 1.3;

// Small LRU cache (Map keeps insertion order).
function lru(max) {
  const map = new Map();
  return {
    get(key) {
      if (!map.has(key)) return undefined;
      const { value, expires } = map.get(key);
      if (expires < Date.now()) { map.delete(key); return undefined; }
      map.delete(key);
      map.set(key, { value, expires });
      return value;
    },
    set(key, value, ttlMs) {
      map.delete(key);
      map.set(key, { value, expires: Date.now() + ttlMs });
      if (map.size > max) map.delete(map.keys().next().value);
    }
  };
}

const directionsCache = lru(500);
const placesCache = lru(1000);
const roundKey = (p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

function straightDirections(points) {
  const legs = [];
  const steps = [];
  for (let i = 0; i < points.length - 1; i++) {
    const distance = haversine(points[i], points[i + 1]) * DETOUR;
    const duration = distance / FALLBACK_SPEED_MS;
    legs.push({ distance, duration });
    steps.push({ instruction: 'Continue to the next stop', distance, duration, location: points[i] });
  }
  return {
    coordinates: straightPath(points),
    distance: legs.reduce((s, l) => s + l.distance, 0),
    duration: legs.reduce((s, l) => s + l.duration, 0),
    legs,
    steps,
    source: 'straight'
  };
}

async function orsChunk(points) {
  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: {
      Authorization: process.env.ORS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/geo+json'
    },
    // radiuses: snap each stop to a road within 1 km (default 350 m), so a stop placed a little off the
    // road (e.g. an estimated position) still routes instead of turning the whole route into straight lines.
    body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]), radiuses: points.map(() => SNAP_RADIUS_M), instructions: true }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    // ORS explains itself, e.g. "Could not find routable point within a radius of 350 m of coordinate 3".
    const detail = await res.json().then((b) => b?.error?.message || b?.error).catch(() => '');
    throw new Error(`OpenRouteService ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  const feature = (await res.json()).features?.[0];
  if (!feature) throw new Error('OpenRouteService returned no route');
  const coordinates = feature.geometry.coordinates;
  const segments = feature.properties.segments || [];
  return {
    coordinates,
    legs: segments.map((s) => ({ distance: s.distance, duration: s.duration })),
    steps: segments.flatMap((s) => (s.steps || []).map((step) => {
      const [lng, lat] = coordinates[step.way_points?.[0] ?? 0] || [];
      return { instruction: step.instruction, distance: step.distance, duration: step.duration, location: { lat, lng } };
    }))
  };
}

async function orsDirections(points) {
  // ORS accepts at most 50 waypoints per request: chunk with 1-point overlap.
  const result = { coordinates: [], legs: [], steps: [] };
  for (let start = 0; start < points.length - 1; start += ORS_MAX_WAYPOINTS - 1) {
    const chunk = await orsChunk(points.slice(start, start + ORS_MAX_WAYPOINTS)).catch((error) => {
      // "...of specified coordinate 2: ..." -> which of our points (0-based) the problem is.
      const n = /coordinate (\d+)/.exec(error.message)?.[1];
      if (n != null) error.pointIndex = start + Number(n);
      throw error;
    });
    result.coordinates.push(...(result.coordinates.length ? chunk.coordinates.slice(1) : chunk.coordinates));
    result.legs.push(...chunk.legs);
    result.steps.push(...chunk.steps);
  }
  return {
    ...result,
    distance: result.legs.reduce((s, l) => s + l.distance, 0),
    duration: result.legs.reduce((s, l) => s + l.duration, 0),
    source: 'routing'
  };
}

/**
 * Road directions through points [{lat, lng}, ...].
 * Returns { coordinates: [[lng,lat]...], distance (m), duration (s), legs, steps, source }.
 */
export async function getDirections(points) {
  if (!Array.isArray(points) || points.length < 2) throw new Error('At least two points are required');
  const key = points.map(roundKey).join(';');
  const cached = directionsCache.get(key);
  if (cached) return cached;

  if (process.env.ORS_API_KEY) {
    try {
      const result = await orsDirections(points);
      directionsCache.set(key, result, 6 * 60 * 60 * 1000);
      return result;
    } catch (error) {
      // Not cached: a rate limit or a bad key must not pin straight lines for hours.
      console.warn('Routing failed, using straight lines:', error.message);
      return { ...straightDirections(points), routingError: error.message, routingErrorPoint: error.pointIndex };
    }
  }
  const result = straightDirections(points);
  directionsCache.set(key, result, 6 * 60 * 60 * 1000);
  return result;
}

/** Place search within India, biased towards `near` ({lat, lng}). Returns [] on any failure. */
export async function searchPlaces(query, near) {
  const q = String(query || '').trim().slice(0, 100);
  if (q.length < 3) return [];
  const key = `${q.toLowerCase()}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''}`;
  const cached = placesCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ q, limit: '6', lang: 'en', bbox: INDIA_BBOX });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }
  try {
    const res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = await res.json();
    const places = (data.features || []).map((f) => {
      const p = f.properties || {};
      const [lng, lat] = f.geometry?.coordinates || [];
      const area = [p.district || p.city || p.county, p.state].filter(Boolean);
      const name = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || area[0] || q;
      return {
        type: 'place',
        name,
        label: [...new Set([name, ...area])].join(', '),
        lat,
        lng
      };
    }).filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
    placesCache.set(key, places, 10 * 60 * 1000);
    return places;
  } catch (error) {
    console.warn('Place search failed:', error.message);
    return [];
  }
}
