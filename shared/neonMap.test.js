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
