import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversine, buildPathIndex, projectOntoPath } from '../../shared/geo.js';
import { initialWarningState, stepWarnings } from '../../shared/locationWarnings.js';
import { departureDates, matchScheduledDeparture, nextScheduledArrival } from '../services/schedule.js';
import { buildGraph, planWithGraph } from '../services/journeyPlanner.js';
import { saveDocument, readDocument } from '../services/storage.js';

// ---------- storage ----------

test('broken CLOUDINARY_URL falls back to disk instead of failing the driver application', async () => {
  process.env.CLOUDINARY_URL = 'cloudinary://bad';
  try {
    const key = await saveDocument({ buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), mime: 'image/jpeg' });
    assert.match(key, /^local:/);
    assert.equal((await readDocument(key)).mime, 'image/jpeg');
  } finally {
    delete process.env.CLOUDINARY_URL;
  }
});

// ---------- geo ----------

test('haversine: 1 degree of latitude is ~111 km', () => {
  const d = haversine({ lat: 30, lng: 76 }, { lat: 31, lng: 76 });
  assert.ok(Math.abs(d - 111195) < 200, d);
});

test('projectOntoPath: distance along and perpendicular offset', () => {
  // East-west line, 1 km long at lat 30.
  const index = buildPathIndex([[76.0, 30.0], [76.0104, 30.0]]);
  assert.ok(Math.abs(index.total - 1000) < 10, index.total);
  const p = projectOntoPath(index, { lat: 30.0009, lng: 76.0052 }); // ~100 m north of the midpoint
  assert.ok(Math.abs(p.along - 500) < 15, p.along);
  assert.ok(Math.abs(p.offset - 100) < 5, p.offset);
});

test('projectOntoPath: prefers forward match on a path that doubles back', () => {
  // Out and back along the same street.
  const index = buildPathIndex([[76.0, 30.0], [76.0104, 30.0], [76.0, 30.0001]]);
  const p = projectOntoPath(index, { lat: 30.00005, lng: 76.0052 }, 1200);
  assert.ok(p.along > 1000, `expected the return leg, got along=${p.along}`);
});

// ---------- location warnings (driver location off) ----------

const run = (steps, state = initialWarningState()) => {
  const events = [];
  for (const [t, on] of steps) {
    const r = stepWarnings(state, { locationOn: on, now: t * 1000 });
    state = r.state;
    if (r.event) events.push({ ...r.event, t });
  }
  return { state, events };
};

test('warnings: off 15 s -> warning 1, 30 s -> warning 2, 45 s -> escalate to admin', () => {
  const steps = [];
  for (let t = 0; t <= 46; t += 1) steps.push([t, false]);
  const { events } = run(steps);
  assert.deepEqual(events, [
    { type: 'warning', count: 1, t: 15 },
    { type: 'warning', count: 2, t: 30 },
    { type: 'escalate', count: 2, t: 45 }
  ]);
});

test('warnings: turning location on does not reset the count', () => {
  const steps = [];
  for (let t = 0; t <= 16; t++) steps.push([t, false]); // warning 1 at 15 s
  for (let t = 17; t <= 60; t++) steps.push([t, true]); // back on for a while
  for (let t = 61; t <= 76; t++) steps.push([t, false]); // off again: 15 s later -> warning 2
  const { events } = run(steps);
  assert.deepEqual(events.map((e) => [e.type, e.count, e.t]), [['warning', 1, 15], ['warning', 2, 76]]);
});

test('warnings: short blips under 15 s never warn', () => {
  const steps = [];
  for (let cycle = 0; cycle < 5; cycle++) {
    for (let t = 0; t < 14; t++) steps.push([cycle * 20 + t, false]);
    for (let t = 14; t < 20; t++) steps.push([cycle * 20 + t, true]);
  }
  assert.equal(run(steps).events.length, 0);
});

test('warnings: after 2 warnings, a later off period escalates (count restored after app restart)', () => {
  const steps = [];
  for (let t = 0; t <= 15; t++) steps.push([t, false]);
  const { events } = run(steps, initialWarningState(2));
  assert.deepEqual(events, [{ type: 'escalate', count: 2, t: 15 }]);
});

// ---------- schedule (timezone-aware departures) ----------

test('departures are interpreted in India time even on a UTC server', () => {
  const now = new Date('2026-11-15T03:00:00Z'); // 08:30 IST
  const dates = departureDates(['08:00'], now, 'Asia/Kolkata');
  assert.ok(dates.some((d) => d.toISOString() === '2026-11-15T02:30:00.000Z'));
  assert.equal(matchScheduledDeparture(['08:00', '09:00'], now).toISOString(), '2026-11-15T02:30:00.000Z');
  // Next arrival at a stop 10 min into the route, after 08:30 IST -> 09:00 + 10 = 09:10 IST
  assert.equal(nextScheduledArrival(['08:00', '09:00'], 10, now).toISOString(), '2026-11-15T03:40:00.000Z');
});

test('no scheduled departure within 90 minutes -> null', () => {
  assert.equal(matchScheduledDeparture(['06:00'], new Date('2026-11-15T09:00:00Z')), null);
});

// ---------- journey planner (Dijkstra) ----------

// Synthetic grid city: stops ~1 km apart along lat 30.0 (route A) and lng 76.03 (route B).
const stop = (id, lat, lng) => ({ id, name: id, lat, lng });
const KM = 0.009; // ~1 km in latitude degrees; longitude at lat 30 is ~0.0104 per km
const compiled = (id, stops, minutesPerHop = 3) => ({
  id, number: id, name: `Route ${id}`, color: '#000', departures: [],
  stops: stops.map((s, i) => ({ ...s, offsetMinutes: i * minutesPerHop, along: i * 1000 }))
});
const A = compiled('A', [stop('a0', 30, 76.0), stop('a1', 30, 76.0104), stop('a2', 30, 76.0208), stop('x', 30, 76.0312)]);
const B = compiled('B', [stop('x', 30, 76.0312), stop('b1', 30 + KM, 76.0312), stop('b2', 30 + 2 * KM, 76.0312)]);
const fixedWait = (minutes) => () => ({ minutes, source: 'estimate' });

test('planner: single ride when origin and destination are on one route', () => {
  const graph = buildGraph([A, B]);
  const [best] = planWithGraph(graph, { from: { lat: 30.0005, lng: 76.0 }, to: { lat: 30.0005, lng: 76.0208 }, waitFor: fixedWait(2) });
  const rides = best.legs.filter((l) => l.type === 'ride');
  assert.equal(rides.length, 1);
  assert.equal(rides[0].route.id, 'A');
  assert.equal(rides[0].from.id, 'a0');
  assert.equal(rides[0].to.id, 'a2');
  assert.equal(rides[0].stops, 2);
});

test('planner: transfers between routes at a shared stop', () => {
  const graph = buildGraph([A, B]);
  const options = planWithGraph(graph, { from: { lat: 30, lng: 76.0 }, to: { lat: 30 + 2 * KM, lng: 76.0312 }, waitFor: fixedWait(2) });
  const best = options[0];
  assert.deepEqual(best.legs.filter((l) => l.type === 'ride').map((l) => l.route.id), ['A', 'B']);
  assert.equal(best.transfers, 1);
  // 2 waits + 2 board penalties + 3 hops on A (9) + 2 hops on B (6) + small walks
  assert.ok(best.totalMinutes >= 19 && best.totalMinutes <= 23, best.totalMinutes);
});

test('planner: prefers the bus that comes sooner (live wait times)', () => {
  // Two parallel routes over the same stops; route F is slower per hop but its bus arrives now.
  const S = compiled('S', [stop('p0', 31, 77), stop('p1', 31, 77.0104), stop('p2', 31, 77.0208)], 3);
  const F = compiled('F', [stop('p0', 31, 77), stop('p1', 31, 77.0104), stop('p2', 31, 77.0208)], 4);
  const graph = buildGraph([S, F]);
  const waitFor = (route) => (route.id === 'S' ? { minutes: 20, source: 'live' } : { minutes: 0, source: 'live' });
  const options = planWithGraph(graph, { from: { lat: 31, lng: 77 }, to: { lat: 31, lng: 77.0208 }, waitFor });
  assert.equal(options[0].legs.find((l) => l.type === 'ride').route.id, 'F');
  assert.equal(options[1].legs.find((l) => l.type === 'ride').route.id, 'S'); // alternative uses a different bus
});

test('planner: unreachable destination gives no bus options', () => {
  const graph = buildGraph([A]);
  const options = planWithGraph(graph, { from: { lat: 30, lng: 76 }, to: { lat: 25, lng: 80 }, waitFor: fixedWait(1) });
  assert.deepEqual(options, []);
});

test('planner: short trips also offer walking', () => {
  const graph = buildGraph([A]);
  const options = planWithGraph(graph, { from: { lat: 30, lng: 76.0 }, to: { lat: 30, lng: 76.0104 }, waitFor: fixedWait(30) });
  assert.ok(options[0].walkOnly, 'walking 1 km beats waiting 30 min');
});

test('Indore demo data is consistent', async () => {
  const { readFileSync } = await import('node:fs');
  const city = JSON.parse(readFileSync(new URL('../data/indore.json', import.meta.url)));
  assert.equal(city.routes.length, 12);
  for (const r of city.routes) {
    for (const s of r.stops) assert.ok(city.stops[s], `route ${r.number}: unknown stop ${s}`);
    assert.equal(r.offsets.length, r.stops.length);
    assert.ok(r.offsets.every((m, i) => i === 0 ? m === 0 : m >= r.offsets[i - 1]), `route ${r.number}: offsets go backwards`);
  }
  const plates = city.buses.map((b) => b.plateNumber);
  assert.ok(plates.every((p) => /^MP09TR\d{4}$/.test(p)));
  assert.equal(new Set(plates).size, plates.length);
  for (const [, lat, lng] of Object.values(city.stops)) assert.ok(lat > 22.55 && lat < 22.85 && lng > 75.7 && lng < 76.02, 'stop outside Indore');
});
