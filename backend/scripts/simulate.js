// Bus simulator for demos: signs in as the demo drivers, starts trips and drives each bus along its
// route path, sending GPS pings through the real API (so ETAs, sockets and the admin map all update).
// Usage: node scripts/simulate.js [apiBase=http://localhost:5000/api] [driverCount=12]
import { buildPathIndex, pointAtDistance } from '../../shared/geo.js';

const PASSWORD = 'Demo@1234';
const demoDrivers = (n) => Array.from({ length: n }, (_, i) => `demo.driver${i + 1}@transit.local`);

async function call(api, method, path, body, token) {
  const res = await fetch(api + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data?.message || ''}`);
  return data;
}

async function runBus(api, email, i, { tickMs, speed, log }) {
  const { token } = await call(api, 'POST', '/auth/driver/login', { email, password: PASSWORD });
  for (;;) {
    let trip = await call(api, 'GET', '/trips/driver/active', null, token);
    if (!trip) {
      const me = await call(api, 'GET', '/auth/driver/me', null, token);
      const first = me.route?.stops?.[0];
      if (first) trip = await call(api, 'POST', '/trips/start', { startLocation: { lat: first.lat, lng: first.lng } }, token).catch(() => null);
    }
    const path = trip?.routeDetails?.path;
    if (!path || path.length < 2) { log(`${email}: no route path, retrying in 30 s`); await new Promise((r) => setTimeout(r, 30000)); continue; }
    const index = buildPathIndex(path);
    // Stagger buses along their routes so the demo looks lived-in.
    let along = trip.live?.location ? 0 : index.total * ((i * 0.23) % 0.8);
    log(`Bus ${trip.bus.busNumber} on route ${trip.routeDetails.number}: ${(index.total / 1000).toFixed(1)} km`);
    while (along < index.total) {
      const jitter = (Math.random() - 0.5) * 0.00004;
      const p = pointAtDistance(index, along);
      await call(api, 'POST', '/locations', { tripId: trip._id, coordinates: { lat: p.lat + jitter, lng: p.lng + jitter } }, token)
        .catch((e) => log(e.message));
      along += speed * (tickMs / 1000) * (0.6 + Math.random() * 0.8);
      await new Promise((r) => setTimeout(r, tickMs));
    }
    const end = pointAtDistance(index, index.total);
    await call(api, 'POST', `/trips/${trip._id}/end`, { endLocation: end }, token).catch((e) => log(e.message));
    log(`Bus ${trip.bus.busNumber} finished route ${trip.routeDetails.number}; next trip in 20 s`);
    await new Promise((r) => setTimeout(r, 20000));
  }
}

/** Start all demo buses. speed in m/s (default 14 ≈ 50 km/h, a little fast so the demo moves). */
export function simulate({ api = 'http://localhost:5000/api', drivers = demoDrivers(12), tickMs = 3000, speed = 14, log = console.log } = {}) {
  drivers.forEach((email, i) => {
    setTimeout(() => runBus(api, email, i, { tickMs, speed, log }).catch((e) => log(`${email}: ${e.message}`)), i * 700);
  });
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/simulate.js')) {
  simulate({ api: process.argv[2] || 'http://localhost:5000/api', drivers: demoDrivers(Number(process.argv[3]) || 12) });
}
