// Live state of every active trip, kept in memory so a GPS ping needs no database reads.
// Responsibilities: position + speed, distance travelled, route progress, ETAs, delay,
// off-route detection, signal-lost watchdog, sampled history writes, and arrival alerts.
//
// ponytail: in-memory state assumes ONE server instance (free hosting). If we ever run several,
// move this state to Redis and add the Socket.IO Redis adapter.
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import Route from '../models/Route.js';
import Driver from '../models/Driver.js';
import User from '../models/User.js';
import Location from '../models/Location.js';
import { buildPathIndex, projectOntoPath, haversine, straightPath } from '../../shared/geo.js';
import { createIncident, autoResolve } from './incidents.js';
import { getIO, emitToUser } from './realtime.js';
import { sendPush } from './push.js';
import { matchScheduledDeparture } from './schedule.js';
import { isDriverAllowed } from '../middleware/auth.js';

export const CONFIG = {
  defaultSpeed: 5, // m/s (~18 km/h): ETA speed until we have measurements (never shown as the bus's speed)
  minEtaSpeed: 3, // m/s floor so a bus waiting at a light doesn't show "ETA: 2 hours"
  speedFreshMs: 15 * 1000, // no new GPS fix for this long = standing still (phones only report after moving ~5-10 m)
  jitterSpeed: 1, // m/s: measured speeds below this are GPS jitter on a parked bus
  offRouteMeters: 150,
  offRouteMs: 2 * 60 * 1000,
  signalLostMs: 60 * 1000,
  historyEveryMs: 30 * 1000,
  historyEveryMeters: 100,
  flushMs: 10 * 1000,
  persistMs: 30 * 1000,
  watchdogMs: 15 * 1000,
  stopPassedMeters: 25,
  arrivalWatchTtlMs: 2 * 60 * 60 * 1000
};

const routes = new Map(); // routeId -> compiled route
const byDriver = new Map(); // driverId -> trip state
const byBus = new Map(); // busId -> trip state (same objects)
let historyBuffer = [];
let arrivalWatches = []; // { userId, routeId, stopId, stopsBefore, createdAt }
const timers = [];

const id = (v) => (v ? String(v._id ?? v) : null);

// ---------- Routes ----------

/** Load and compile a route: stops with their distance along the path. Cached. */
export async function getRoute(routeId) {
  const key = id(routeId);
  if (!key) return null;
  if (routes.has(key)) return routes.get(key);
  const doc = await Route.findById(key).populate('stops.stop');
  if (!doc) return null;
  const compiled = compileRoute(doc);
  routes.set(key, compiled);
  return compiled;
}

export function compileRoute(doc) {
  const stops = doc.stops
    .filter((s) => s.stop?.location?.coordinates)
    .map((s) => ({
      id: id(s.stop),
      name: s.stop.name,
      lat: s.stop.location.coordinates[1],
      lng: s.stop.location.coordinates[0],
      offsetMinutes: s.offsetMinutes || 0
    }));
  const coords = doc.path?.coordinates?.length >= 2 ? doc.path.coordinates : straightPath(stops);
  const index = buildPathIndex(coords);
  let along = 0;
  for (const stop of stops) {
    along = index ? projectOntoPath(index, stop, along).along : 0;
    stop.along = along;
  }
  return {
    id: id(doc),
    number: doc.number,
    name: doc.name,
    color: doc.color,
    departures: doc.departures || [],
    stops,
    index
  };
}

/** Call after a route or its stops change. */
export function invalidateRoute(routeId) {
  if (routeId) routes.delete(id(routeId));
  else routes.clear();
  for (const state of byDriver.values()) {
    if (!routeId || state.routeId === id(routeId)) state.route = undefined; // reload lazily
  }
}

// ---------- Trips ----------

function newState({ trip, busId, busNumber, route, position, lastPingAt }) {
  return {
    tripId: id(trip),
    driverId: id(trip.driver),
    busId,
    busNumber,
    routeId: route?.id || null,
    route,
    startTime: trip.startTime,
    scheduledDeparture: trip.scheduledDeparture || null,
    position: position || null,
    speed: 0, // m/s, latest measured/reported speed (what drivers, passengers and admins see)
    etaSpeed: CONFIG.defaultSpeed, // m/s, smoothed, for ETAs
    heading: 0,
    lastPingAt, // when the last live ping ARRIVED: liveness (signal-lost watchdog), ordering
    lastFixAt: lastPingAt, // when the last GPS fix was TAKEN: speed and distance
    lastHistoryAt: 0,
    lastHistoryPos: null,
    along: 0,
    totalDistance: trip.totalDistance || 0,
    nextStopIndex: 0,
    etas: [],
    delayMinutes: trip.delayMinutes || 0,
    offRouteSince: null,
    offRouteFlagged: false,
    signalLostFlagged: false,
    dirty: false
  };
}

/** Register a just-started trip. `bus` must have busNumber and route. Sets trip.route/scheduledDeparture. */
export async function startTrip(trip, bus) {
  const route = await getRoute(bus.route);
  trip.route = route?.id || null;
  trip.scheduledDeparture = route ? matchScheduledDeparture(route.departures, trip.startTime) : null;
  const state = newState({
    trip,
    busId: id(bus),
    busNumber: bus.busNumber,
    route,
    position: trip.startLocation?.lat != null ? { lat: trip.startLocation.lat, lng: trip.startLocation.lng } : null,
    lastPingAt: Date.now()
  });
  byDriver.set(state.driverId, state);
  byBus.set(state.busId, state);
  if (state.position) updateProgress(state, Date.now());
  return state;
}

/**
 * Active trip for a driver. Cache hit = no DB access. On a miss (e.g. after a server restart)
 * it checks the driver is still allowed and restores the trip from the database.
 */
export async function getActiveTrip(driverId) {
  const key = id(driverId);
  if (byDriver.has(key)) return byDriver.get(key);
  const driver = await Driver.findById(key).select('status isActive');
  if (!isDriverAllowed(driver)) return null;
  const trip = await Trip.findOne({ driver: key, status: 'active' }).populate('bus', 'busNumber route currentLocation');
  if (!trip?.bus) return null;
  const route = await getRoute(trip.bus.route);
  const loc = trip.bus.currentLocation;
  const state = newState({
    trip,
    busId: id(trip.bus),
    busNumber: trip.bus.busNumber,
    route,
    position: loc?.lat != null ? { lat: loc.lat, lng: loc.lng } : null,
    lastPingAt: Date.now() // grace period after restart
  });
  byDriver.set(key, state);
  byBus.set(state.busId, state);
  return state;
}

/** Drop a driver from the cache (trip ended, driver suspended/rejected). */
export function evictDriver(driverId) {
  const state = byDriver.get(id(driverId));
  if (!state) return null;
  byDriver.delete(state.driverId);
  byBus.delete(state.busId);
  return state;
}

/** Finish a trip. Returns final { totalDistance, delayMinutes } and resolves its system incidents. */
export async function endTrip(driverId) {
  const state = evictDriver(driverId);
  if (!state) return null;
  await flushHistory();
  for (const type of ['off-route', 'signal-lost', 'location-off']) {
    await autoResolve(state.tripId, type).catch(() => {});
  }
  return { totalDistance: Math.round(state.totalDistance), delayMinutes: state.delayMinutes };
}

// ---------- Pings ----------

function updateProgress(state, now) {
  if (state.route === undefined) return; // reloading
  const route = state.route;
  if (!route?.index || !state.position) {
    state.etas = [];
    return;
  }
  const proj = projectOntoPath(route.index, state.position, Math.max(0, state.along - 300));
  state.along = proj.along;

  // Off-route: more than 150 m from the path for more than 2 minutes -> flag admin.
  if (proj.offset > CONFIG.offRouteMeters) {
    state.offRouteSince ??= now;
    if (!state.offRouteFlagged && now - state.offRouteSince >= CONFIG.offRouteMs) {
      state.offRouteFlagged = true;
      createIncident({
        type: 'off-route', source: 'system', driver: state.driverId, bus: state.busId, trip: state.tripId,
        location: state.position, note: `About ${Math.round(proj.offset)} m from the planned route`
      }).catch((e) => console.error('Off-route incident failed:', e.message));
    }
  } else {
    state.offRouteSince = null;
    if (state.offRouteFlagged) {
      state.offRouteFlagged = false;
      autoResolve(state.tripId, 'off-route').catch(() => {});
    }
  }

  const speed = Math.max(state.etaSpeed, CONFIG.minEtaSpeed);
  const next = route.stops.findIndex((s) => s.along > state.along + CONFIG.stopPassedMeters);
  state.nextStopIndex = next === -1 ? route.stops.length : next;
  state.etas = route.stops.slice(state.nextStopIndex).map((s) => ({
    stopId: s.id,
    minutes: Math.max(0, Math.round((s.along - state.along) / speed / 60))
  }));

  const nextStop = route.stops[state.nextStopIndex];
  if (state.scheduledDeparture && nextStop) {
    const scheduledAt = new Date(state.scheduledDeparture).getTime() + nextStop.offsetMinutes * 60000;
    const expectedAt = now + state.etas[0].minutes * 60000;
    state.delayMinutes = Math.round((expectedAt - scheduledAt) / 60000);
  }
}

/** Public view of a bus (what passengers and admins receive). */
export function busView(state) {
  const route = state.route;
  const nextStop = route?.stops?.[state.nextStopIndex];
  return {
    busId: state.busId,
    busNumber: state.busNumber,
    tripId: state.tripId,
    routeId: state.routeId,
    routeNumber: route?.number ?? null,
    location: state.position ? { ...state.position, timestamp: new Date(state.lastPingAt) } : null,
    speed: Math.round((Date.now() - state.lastFixAt > CONFIG.speedFreshMs ? 0 : state.speed) * 3.6), // km/h
    heading: state.heading,
    nextStop: nextStop ? { id: nextStop.id, name: nextStop.name, etaMinutes: state.etas[0]?.minutes ?? null } : null,
    etas: state.etas,
    delayMinutes: state.scheduledDeparture ? state.delayMinutes : null,
    offRoute: state.offRouteSince !== null,
    lastUpdate: new Date(state.lastPingAt)
  };
}

/**
 * Record a GPS point. `live: false` is for late points flushed from the driver's offline queue:
 * they update history, distance and the latest known position, but are never broadcast as live.
 * timestamp: when the point arrived (live) or was taken (queued). fixAt: when the phone took the
 * GPS fix, if it says. speed: the phone's GPS speed in m/s, or null when the phone doesn't know.
 */
export async function recordPing(state, { lat, lng, speed = null, heading = 0, timestamp = Date.now(), fixAt }, { live = true } = {}) {
  const ts = new Date(timestamp).getTime();
  const fixTime = Math.min(Number.isFinite(fixAt) ? fixAt : ts, Date.now()); // never in the future (clock skew)
  const point = { lat, lng };

  if (state.route === undefined) state.route = await getRoute(state.routeId);

  // Speed: the phone's GPS speed when it reports one (Doppler: accurate, instant); otherwise distance /
  // time between FIXES. Arrival times are distorted by network delay and by fixes sent in batches.
  let sample = Number.isFinite(speed) && speed >= 0 ? Math.min(speed, 40) : null;
  if (state.position && fixTime > state.lastFixAt) {
    const d = haversine(state.position, point);
    const dt = (fixTime - state.lastFixAt) / 1000;
    if (d / dt < 50) { // ignore GPS jumps faster than 180 km/h
      state.totalDistance += d;
      if (sample == null && dt >= 1) sample = d / dt < CONFIG.jitterSpeed ? 0 : Math.min(d / dt, 25);
    }
  }
  if (fixTime > state.lastFixAt) {
    state.lastFixAt = fixTime;
    if (sample != null) {
      state.speed = sample;
      state.etaSpeed = 0.7 * state.etaSpeed + 0.3 * Math.min(sample, 25);
    }
  }

  // Sampled history: every 30 s or 100 m.
  if (!state.lastHistoryPos || ts - state.lastHistoryAt >= CONFIG.historyEveryMs ||
      haversine(state.lastHistoryPos, point) >= CONFIG.historyEveryMeters) {
    historyBuffer.push({
      timestamp: new Date(ts),
      meta: { bus: state.busId, trip: state.tripId, driver: state.driverId },
      lat, lng, speed: Math.max(0, speed || 0), heading: heading || 0
    });
    state.lastHistoryAt = ts;
    state.lastHistoryPos = point;
  }

  // Older than what we already know (late queued point): history only.
  if (ts <= state.lastPingAt && state.position) return null;

  // Newest known position (even if it arrived late from the offline queue).
  state.position = point;
  state.heading = heading || state.heading;
  state.lastPingAt = ts;
  state.dirty = true;
  updateProgress(state, ts);

  if (state.signalLostFlagged) {
    state.signalLostFlagged = false;
    autoResolve(state.tripId, 'signal-lost').catch(() => {});
  }

  if (!live) return null; // stale: don't broadcast as the bus's current position
  const view = busView(state);
  const rooms = [`bus-${state.busId}`, 'admins'];
  if (state.routeId) rooms.push(`route-${state.routeId}`);
  getIO()?.to(rooms).emit('location-update', view);
  checkArrivalWatches(state);
  return view;
}

// ---------- Queries ----------

export function getLiveBuses(routeId) {
  return [...byBus.values()]
    .filter((s) => !routeId || s.routeId === id(routeId))
    .map(busView);
}

export const getLiveBus = (busId) => {
  const state = byBus.get(id(busId));
  return state ? busView(state) : null;
};

/** Upcoming live arrivals at a stop across all routes, soonest first. */
export function getArrivals(stopId) {
  const key = id(stopId);
  const arrivals = [];
  for (const state of byBus.values()) {
    const eta = state.etas.find((e) => e.stopId === key);
    if (eta) {
      arrivals.push({
        busId: state.busId, busNumber: state.busNumber, routeId: state.routeId,
        routeNumber: state.route?.number ?? null, minutes: eta.minutes
      });
    }
  }
  return arrivals.sort((a, b) => a.minutes - b.minutes);
}

/** Minutes until the next live bus on a route reaches a stop, no earlier than `afterMinutes`. */
export function nextLiveArrival(routeId, stopId, afterMinutes = 0) {
  let best = null;
  for (const state of byBus.values()) {
    if (state.routeId !== id(routeId)) continue;
    const eta = state.etas.find((e) => e.stopId === id(stopId));
    if (eta && eta.minutes >= afterMinutes - 1 && (!best || eta.minutes < best.minutes)) {
      best = { minutes: eta.minutes, busId: state.busId, busNumber: state.busNumber };
    }
  }
  return best;
}

// ---------- Arrival alerts ("notify me when my bus is 2 stops away") ----------

export function addArrivalWatch({ userId, routeId, stopId, stopsBefore = 2 }) {
  arrivalWatches = arrivalWatches.filter((w) => !(w.userId === id(userId) && w.stopId === id(stopId)));
  arrivalWatches.push({ userId: id(userId), routeId: id(routeId), stopId: id(stopId), stopsBefore, createdAt: Date.now() });
}

export function removeArrivalWatch(userId, stopId) {
  arrivalWatches = arrivalWatches.filter((w) => !(w.userId === id(userId) && w.stopId === id(stopId)));
}

function checkArrivalWatches(state) {
  if (!state.route || !arrivalWatches.length) return;
  const fired = [];
  for (const w of arrivalWatches) {
    if (w.routeId !== state.routeId) continue;
    const stopIndex = state.route.stops.findIndex((s) => s.id === w.stopId);
    const stopsAway = stopIndex - state.nextStopIndex;
    if (stopIndex >= 0 && stopsAway >= 0 && stopsAway <= w.stopsBefore) {
      fired.push(w);
      const stop = state.route.stops[stopIndex];
      const minutes = state.etas.find((e) => e.stopId === w.stopId)?.minutes;
      const payload = {
        busId: state.busId, busNumber: state.busNumber, routeNumber: state.route.number,
        stopId: w.stopId, stopName: stop.name, stopsAway, minutes
      };
      emitToUser(w.userId, 'arrival-alert', payload);
      User.findById(w.userId).select('pushTokens').then((user) => sendPush(user?.pushTokens, {
        title: `Bus ${state.busNumber} is ${stopsAway === 0 ? 'arriving' : `${stopsAway} stop${stopsAway > 1 ? 's' : ''} away`}`,
        body: `Route ${state.route.number} → ${stop.name}${minutes != null ? ` in about ${minutes} min` : ''}`,
        data: payload
      })).catch(() => {});
    }
  }
  if (fired.length) arrivalWatches = arrivalWatches.filter((w) => !fired.includes(w));
}

// ---------- Background jobs ----------

export async function flushHistory() {
  if (!historyBuffer.length) return;
  const docs = historyBuffer;
  historyBuffer = [];
  try {
    await Location.insertMany(docs, { ordered: false });
  } catch (error) {
    console.error('History flush failed:', error.message);
  }
}

async function persistDirty() {
  for (const state of byBus.values()) {
    if (!state.dirty) continue;
    state.dirty = false;
    await Promise.all([
      Bus.updateOne({ _id: state.busId }, {
        currentLocation: { lat: state.position.lat, lng: state.position.lng, timestamp: new Date(state.lastPingAt) }
      }),
      Trip.updateOne({ _id: state.tripId }, {
        totalDistance: Math.round(state.totalDistance),
        delayMinutes: state.delayMinutes
      })
    ]).catch((e) => console.error('Persist failed:', e.message));
  }
}

export function runWatchdog(now = Date.now()) {
  for (const state of byBus.values()) {
    if (!state.signalLostFlagged && now - state.lastPingAt > CONFIG.signalLostMs) {
      state.signalLostFlagged = true;
      createIncident({
        type: 'signal-lost', source: 'system', driver: state.driverId, bus: state.busId, trip: state.tripId,
        location: state.position, note: 'No location received for over a minute'
      }).catch((e) => console.error('Signal-lost incident failed:', e.message));
    }
  }
  arrivalWatches = arrivalWatches.filter((w) => now - w.createdAt < CONFIG.arrivalWatchTtlMs);
}

export function start() {
  if (timers.length) return;
  timers.push(
    setInterval(flushHistory, CONFIG.flushMs),
    setInterval(persistDirty, CONFIG.persistMs),
    setInterval(() => runWatchdog(), CONFIG.watchdogMs)
  );
  timers.forEach((t) => t.unref());
}

export function stop() {
  timers.splice(0).forEach(clearInterval);
}
