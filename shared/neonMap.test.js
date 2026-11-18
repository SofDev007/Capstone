// node shared/neonMap.test.js — self-check for the dash sequence and the trail ring buffer.
import assert from 'node:assert/strict';
import { FLOW_STEPS, createTrails } from './neonMap.js';

for (const s of FLOW_STEPS) {
  assert.equal(s.length % 2, 0);
  assert.ok(s.every((v) => v >= 0), `negative dash in ${s}`);
  assert.equal(s.reduce((a, b) => a + b, 0), 9, `period broken in ${s}`);
}

// Fake map: records the last setData.
let data;
let queued = [];
let now = 0;
globalThis.requestAnimationFrame = (fn) => { queued.push(fn); return queued.length; };
globalThis.cancelAnimationFrame = () => {};
const flush = () => { now += 1000; const q = queued; queued = []; q.forEach((fn) => fn(now)); };
const map = { addSource() {}, addLayer() {}, getLayer: () => null, getSource: () => ({ setData: (d) => { data = d; } }) };
const trails = createTrails(map, { max: 3 });
trails.push('a', [0, 0], '#3EE6FF');
trails.push('a', [1, 0], '#3EE6FF');
trails.head('a', [0.5, 0]);
flush();
assert.deepEqual(data.features[0].geometry.coordinates, [[0, 0], [0.5, 0]]); // trail ends at the gliding marker
for (let i = 2; i < 8; i++) trails.push('a', [i, 0], '#3EE6FF');
trails.head('a', [6.5, 0]);
flush();
assert.deepEqual(data.features[0].geometry.coordinates, [[5, 0], [6, 0], [6.5, 0]]); // ring buffer keeps max points
console.log('neonMap ok');

// ─── Buses stay on their route (glideMarker / placeOnRoute / on-route trails) ───
const { placeOnRoute, startOnRoute, glideMarker } = await import('./neonMap.js');
const { buildPathIndex, projectOntoPath } = await import('./geo.js');
const L = [[75.80, 22.70], [75.81, 22.70], [75.81, 22.71]]; // ~1 km east, then ~1.1 km north: one 90° bend
const idx = buildPathIndex(L);
const off = (p) => projectOntoPath(idx, { lng: p[0], lat: p[1] }).offset; // metres from the route line

const near = placeOnRoute(L, [75.805, 22.7002]); // ~22 m north of the east leg (GPS noise)
assert.ok(near && off(near.lngLat) < 0.5, 'a fix near the route is drawn on the line');
assert.equal(placeOnRoute(L, [75.805, 22.705]), null, 'a fix ~550 m away is a real off-route bus: not snapped');

const fakeMarker = (p) => ({ p, getLngLat() { return { toArray: () => this.p }; }, setLngLat(q) { this.p = q; return this; } });
const frames = (t0, n, ms) => { for (let i = 1; i <= n; i++) { const q = queued; queued = []; q.forEach((fn) => fn(t0 + (ms * i) / n)); } };
const bus = { raf: 0 };
bus.marker = fakeMarker(startOnRoute(bus, [75.805, 22.70], L));
const drawn = [];
const t0 = performance.now();
glideMarker(bus, [75.81, 22.705], { ms: 1000, path: L, reduceMotion: false, onFrame: (p) => drawn.push(p) });
frames(t0, 20, 1000);
assert.ok(drawn.length >= 10, 'animated in steps');
assert.ok(drawn.every((p) => off(p) < 0.5), `every frame on the route (worst ${Math.max(...drawn.map(off)).toFixed(1)} m)`);
const chordMid = [(75.805 + 75.81) / 2, (22.70 + 22.705) / 2];
assert.ok(off(chordMid) > 200, `the old straight glide cut the corner by ${off(chordMid).toFixed(0)} m`);
assert.ok(Math.abs(bus.marker.p[1] - 22.705) < 1e-6 && Math.abs(bus.marker.p[0] - 75.81) < 1e-6, 'ends at the fix');

queued = []; // drop the previous glide's last frame
glideMarker(bus, [75.8001, 22.70], { ms: 1000, path: L, reduceMotion: false }); // back at the first stop: new trip
assert.equal(queued.length, 0, 'a new trip jumps instead of driving the route backwards');
assert.ok(Math.abs(bus.marker.p[0] - 75.8001) < 1e-6 && off(bus.marker.p) < 0.5);

glideMarker(bus, [75.805, 22.705], { ms: 1000, path: L, reduceMotion: true }); // genuinely off route
assert.deepEqual(bus.marker.p, [75.805, 22.705], 'an off-route fix is shown where it really is');
assert.equal(bus.onRoute, null);

const t2 = createTrails(map, { length: 400 });
t2.push('b', [75.81, 22.701], '#3EE6FF');
t2.head('b', [75.81, 22.701], placeOnRoute(L, [75.81, 22.701])); // ~110 m past the bend
flush();
const trail = data.features[0].geometry.coordinates;
assert.ok(trail.some((p) => p[0] === 75.81 && p[1] === 22.70), 'an on-route trail bends at the corner');
assert.ok(trail.every((p) => off(p) < 0.5), 'trail lies on the route');
console.log('buses on route ok');
