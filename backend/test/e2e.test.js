// End-to-end: real server + in-memory MongoDB + real Socket.IO clients.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as ioClient } from 'socket.io-client';

const PORT = 5077;
const BASE = `http://localhost:${PORT}/api`;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let mongo, mongoose, models, liveTracker, google, seedData, sockets = [];

const call = async (method, url, body, token, headers = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    body: body && JSON.stringify(body)
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
};

const connect = async (token) => {
  const s = ioClient(`http://localhost:${PORT}`, { transports: ['websocket'], auth: token ? { token } : {} });
  sockets.push(s);
  await new Promise((r) => s.on('connect', r));
  return s;
};

/** Resolves with the first event matching `match`, rejects after `ms`. */
const nextEvent = (socket, event, match = () => true, ms = 4000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`timeout waiting for ${event}`)); }, ms);
  function handler(data) {
    if (!match(data)) return;
    clearTimeout(timer);
    socket.off(event, handler);
    resolve(data);
  }
  socket.on(event, handler);
});

/** Collects events for `ms` (to assert something did NOT arrive). */
const collect = (socket, event, ms = 600) => new Promise((resolve) => {
  const got = [];
  const handler = (d) => got.push(d);
  socket.on(event, handler);
  setTimeout(() => { socket.off(event, handler); resolve(got); }, ms);
});

const STOP = {
  isbt43: { lat: 30.7186, lng: 76.7509 },
  sec35: { lat: 30.7247, lng: 76.7608 },
  sec22: { lat: 30.7337, lng: 76.7742 },
  sukhna: { lat: 30.7426, lng: 76.8183 },
  zirakpur: { lat: 30.6425, lng: 76.8173 }
};
const between = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });

before(async () => {
  mongo = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGODB_URI: mongo.getUri('transit'),
    JWT_SECRET: 'test-secret',
    PORT: String(PORT),
    CORS_ORIGINS: 'https://admin.example.com',
    DISABLE_PUSH: 'true'
  });
  delete process.env.ORS_API_KEY;
  delete process.env.CLOUDINARY_URL;

  const server = await import('../server.js');
  await server.ready;
  mongoose = (await import('mongoose')).default;
  models = {
    Admin: (await import('../models/Admin.js')).default,
    Driver: (await import('../models/Driver.js')).default,
    Incident: (await import('../models/Incident.js')).default,
    Location: (await import('../models/Location.js')).default
  };
  liveTracker = await import('../services/liveTracker.js');
  google = await import('../services/google.js');
  seedData = await (await import('../scripts/seed.js')).seed({ city: 'chandigarh', log: () => {} });
  await models.Admin.create({ username: 'boss', email: 'boss@example.com', password: 'adminpass1' });
});

after(async () => {
  sockets.forEach((s) => s.close());
  await mongoose?.disconnect();
  await mongo?.stop();
});

test('platform: security basics', async () => {
  assert.equal((await call('POST', '/auth/admin/create-default')).status, 404);
  const ok = await call('GET', '/health', null, null, { Origin: 'https://admin.example.com' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://admin.example.com');
  const evil = await call('GET', '/health', null, null, { Origin: 'https://evil.example.com' });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  assert.ok(ok.headers.get('x-content-type-options'), 'helmet headers present');
  assert.equal((await call('GET', '/buses')).status, 401);
});

test('full journey: trip, live tracking, incidents, applications, passengers', async (t) => {
  const admin = (await call('POST', '/auth/admin/login', { email: 'boss@example.com', password: 'adminpass1' })).data.token;
  assert.ok(admin);
  const adminSocket = await connect(admin);
  const publicSocket = await connect();

  const login = await call('POST', '/auth/driver/login', { email: 'demo.driver1@transit.local', password: 'Demo@1234' });
  assert.equal(login.status, 200);
  const driver = login.data.token;
  const route1 = String(seedData.routeIds['1']);
  let tripId, busId;

  await t.test('driver starts a trip on route 1 and gets the route for navigation', async () => {
    const res = await call('POST', '/trips/start', { startLocation: STOP.isbt43 }, driver);
    assert.equal(res.status, 201, JSON.stringify(res.data));
    tripId = res.data._id;
    busId = res.data.bus._id;
    assert.equal(res.data.routeDetails.number, '1');
    assert.equal(res.data.routeDetails.stops.length, 7);
    assert.ok(res.data.routeDetails.path.length >= 2);
    assert.ok(res.data.scheduledDeparture === null || typeof res.data.scheduledDeparture === 'string');
  });

  await t.test('pings broadcast to route subscribers with next stop + ETAs, without DB reads', async () => {
    publicSocket.emit('subscribe-route', route1);
    await new Promise((r) => setTimeout(r, 100));

    const queries = [];
    mongoose.set('debug', (collection, method) => queries.push(`${collection}.${method}`));
    const updateP = nextEvent(publicSocket, 'location-update', (d) => d.busId === busId);
    const res = await call('POST', '/locations', { tripId, coordinates: between(STOP.isbt43, STOP.sec35, 0.5) }, driver);
    mongoose.set('debug', false);
    assert.equal(res.status, 201);
    const reads = queries.filter((q) => /^(drivers|trips|buses|routes)\.find/.test(q));
    assert.deepEqual(reads, [], `ping should not read the DB, saw ${queries}`);

    const update = await updateP;
    assert.equal(update.nextStop.name, 'Sector 35 Market');
    assert.equal(update.etas.length, 6);
    assert.ok(update.etas.every((e, i, a) => i === 0 || e.minutes >= a[i - 1].minutes), 'ETAs increase along the route');
    assert.equal(update.offRoute, false);
  });

  await t.test('public endpoints: live buses, nearest stops, arrivals, stop search', async () => {
    const live = await call('GET', `/public/buses/active?route=${route1}`);
    assert.equal(live.data.length, 1);
    const near = await call('GET', `/public/stops/nearest?lat=${STOP.sec22.lat}&lng=${STOP.sec22.lng + 0.001}`);
    assert.equal(near.data[0].name, 'Sector 22 Aroma Chowk');
    assert.ok(near.data[0].routes.some((r) => r.number === '1'));
    const arrivals = await call('GET', `/public/stops/${near.data[0].id}/arrivals`);
    assert.equal(arrivals.data.arrivals[0].busNumber, '101');
    const search = await call('GET', '/public/search?q=sukhna&stopsOnly=true');
    assert.equal(search.data.stops[0].name, 'Sukhna Lake');
  });

  await t.test('journey planner: direct ride uses the live bus', async () => {
    const q = `fromLat=${STOP.sec35.lat + 0.0005}&fromLng=${STOP.sec35.lng}&toLat=${STOP.sukhna.lat + 0.0005}&toLng=${STOP.sukhna.lng}`;
    const res = await call('GET', `/public/journey?${q}`);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.nearestStop.name, 'Sector 35 Market');
    const ride = res.data.options[0].legs.find((l) => l.type === 'ride');
    assert.equal(ride.route.number, '1');
    assert.equal(ride.from.name, 'Sector 35 Market');
    assert.equal(ride.to.name, 'Sukhna Lake');
    assert.equal(ride.waitSource, 'live');
    assert.equal(ride.bus.busNumber, '101');
  });

  await t.test('journey planner: transfer between routes', async () => {
    const q = `fromLat=${STOP.sec22.lat}&fromLng=${STOP.sec22.lng}&toLat=${STOP.zirakpur.lat}&toLng=${STOP.zirakpur.lng}`;
    const res = await call('GET', `/public/journey?${q}`);
    const best = res.data.options[0];
    const rides = best.legs.filter((l) => l.type === 'ride');
    assert.ok(rides.length >= 2, JSON.stringify(best));
    assert.equal(rides.at(-1).route.number, '3');
    assert.equal(rides.at(-1).to.name, 'Zirakpur Chowk');
  });

  await t.test('arrival alert fires for a signed-in passenger', async () => {
    const reg = await call('POST', '/auth/user/register', { name: 'Pia', email: 'pia@example.com', password: 'secret12' });
    const user = reg.data.token;
    const userSocket = await connect(user);
    const sukhna = (await call('GET', '/public/search?q=sukhna&stopsOnly=true')).data.stops[0];
    assert.equal((await call('POST', '/passenger/arrival-alerts', { routeId: route1, stopId: sukhna.id, stopsBefore: 5 }, user)).status, 201);
    const alertP = nextEvent(userSocket, 'arrival-alert');
    await call('POST', '/locations', { tripId, coordinates: between(STOP.sec35, STOP.sec22, 0.6) }, driver);
    const alert = await alertP;
    assert.equal(alert.stopName, 'Sukhna Lake');
    assert.equal(alert.busNumber, '101');
  });

  await t.test('off-route: admin flagged after the grace period, auto-resolved on return', async () => {
    liveTracker.CONFIG.offRouteMs = 0;
    const far = { lat: STOP.sec22.lat + 0.01, lng: STOP.sec22.lng - 0.01 }; // ~1.4 km off the route
    const flagP = nextEvent(adminSocket, 'incident:new', (i) => i.type === 'off-route');
    await call('POST', '/locations', { tripId, coordinates: far }, driver);
    await call('POST', '/locations', { tripId, coordinates: { lat: far.lat + 0.0001, lng: far.lng } }, driver);
    const incident = await flagP;
    assert.equal(incident.bus.busNumber, '101');
    const resolvedP = nextEvent(adminSocket, 'incident:update', (i) => i._id === incident._id && i.status === 'resolved');
    await call('POST', '/locations', { tripId, coordinates: between(STOP.sec22, { lat: 30.7408, lng: 76.7846 }, 0.3) }, driver);
    assert.equal((await resolvedP).resolution, 'auto');
    liveTracker.CONFIG.offRouteMs = 2 * 60 * 1000;
  });

  await t.test('signal lost: watchdog flags, next ping resolves', async () => {
    const flagP = nextEvent(adminSocket, 'incident:new', (i) => i.type === 'signal-lost');
    liveTracker.runWatchdog(Date.now() + 2 * 60 * 1000);
    const incident = await flagP;
    const resolvedP = nextEvent(adminSocket, 'incident:update', (i) => i._id === incident._id && i.status === 'resolved');
    await call('POST', '/locations', { tripId, coordinates: between(STOP.sec22, { lat: 30.7408, lng: 76.7846 }, 0.4) }, driver);
    await resolvedP;
  });

  await t.test('location-off warnings: escalation creates one admin incident', async () => {
    assert.equal((await call('POST', `/trips/${tripId}/location-warning`, { count: 1 }, driver)).data.escalated, false);
    const flagP = nextEvent(adminSocket, 'incident:new', (i) => i.type === 'location-off');
    const res = await call('POST', `/trips/${tripId}/location-warning`, { count: 2, escalate: true }, driver);
    assert.equal(res.data.escalated, true);
    await flagP;
    const again = await call('POST', `/trips/${tripId}/location-warning`, { count: 2, escalate: true }, driver);
    assert.equal(again.data.escalated, false, 'no duplicate while the first is open');
  });

  await t.test('panic: anonymous passenger -> admins only; reason added after; reporter-only edits', async () => {
    const publicIncidents = collect(publicSocket, 'incident:new');
    const adminP = nextEvent(adminSocket, 'incident:new', (i) => i.type === 'panic' && i.source === 'passenger');
    const res = await call('POST', '/incidents/panic', { location: STOP.sec22, deviceId: 'device-abc-123', busId });
    assert.equal(res.status, 201);
    const incident = await adminP;
    assert.equal(incident.bus.busNumber, '101');
    assert.equal((await publicIncidents).length, 0, 'public sockets must not receive incidents');

    const updP = nextEvent(adminSocket, 'incident:update', (i) => i._id === res.data.id && i.reason === 'harassment');
    const detail = await call('PATCH', `/incidents/${res.data.id}/details`, { deviceId: 'device-abc-123', reason: 'harassment', location: STOP.sec35 });
    assert.equal(detail.status, 200);
    assert.equal(detail.data.sharingLocation, true);
    const updated = await updP;
    assert.equal(updated.trail.length, 2);
    assert.equal((await call('PATCH', `/incidents/${res.data.id}/details`, { deviceId: 'someone-else-999', reason: 'other' })).status, 404);
    assert.equal((await call('POST', '/incidents/panic', { location: STOP.sec22 })).status, 400, 'anonymous needs a deviceId');
  });

  await t.test('panic: driver alert carries bus + trip; admin acknowledges and resolves', async () => {
    const adminP = nextEvent(adminSocket, 'incident:new', (i) => i.type === 'panic' && i.source === 'driver');
    const res = await call('POST', '/incidents/panic', { location: STOP.sec22, reason: 'medical' }, driver);
    assert.equal(res.status, 201);
    const incident = await adminP;
    assert.equal(String(incident.trip), tripId);
    assert.equal(incident.driver.name, 'Harpreet Singh');
    assert.equal((await call('POST', `/incidents/${res.data.id}/acknowledge`, {}, admin)).data.status, 'acknowledged');
    const resolved = await call('POST', `/incidents/${res.data.id}/resolve`, { resolution: 'handled', note: 'Ambulance sent' }, admin);
    assert.equal(resolved.data.status, 'resolved');
    const status = await call('GET', `/incidents/${res.data.id}/status`, null, driver);
    assert.equal(status.data.status, 'resolved');
    const list = await call('GET', '/incidents?status=active', null, admin);
    assert.ok(list.data.items.every((i) => i.status !== 'resolved'));
  });

  await t.test('offline queue: queued points count for history + distance, are not broadcast live', async () => {
    // Simulate the phone losing signal 10 minutes ago and queueing points every 40 s.
    const state = await liveTracker.getActiveTrip(login.data.user.id);
    state.lastPingAt = Date.now() - 10 * 60 * 1000;
    const distanceBefore = state.totalDistance;
    const start = Date.now() - 5 * 60 * 1000;
    const points = [0, 40, 80].map((s, i) => ({
      ...between(STOP.sec22, { lat: 30.7408, lng: 76.7846 }, 0.5 + 0.15 * i),
      timestamp: new Date(start + s * 1000).toISOString()
    }));
    const broadcasts = collect(publicSocket, 'location-update');
    assert.equal((await call('POST', '/locations/batch', { tripId, points }, driver)).status, 201);
    assert.equal((await broadcasts).length, 0, 'points older than 30 s are not live');
    assert.equal(liveTracker.getLiveBus(busId).location.lat, points[2].lat, 'newest queued point is the latest known position');
    assert.ok(state.totalDistance - distanceBefore > 300, 'distance between queued points counted');

    // A point older than the latest known one is history only.
    const stale = [{ ...STOP.isbt43, timestamp: new Date(start - 60000).toISOString() }];
    await call('POST', '/locations/batch', { tripId, points: stale }, driver);
    assert.equal(liveTracker.getLiveBus(busId).location.lat, points[2].lat);
    await liveTracker.flushHistory();
    assert.ok(await models.Location.countDocuments({ 'meta.trip': new mongoose.Types.ObjectId(tripId) }) >= 4);
  });

  await t.test('driver ends the trip: distance recorded, system incidents closed, stats updated', async () => {
    const res = await call('POST', `/trips/${tripId}/end`, { endLocation: STOP.sukhna }, driver);
    assert.equal(res.status, 200);
    assert.ok(res.data.totalDistance > 500, `distance ${res.data.totalDistance}`);
    assert.equal(await models.Incident.countDocuments({ trip: tripId, type: { $ne: 'panic' }, status: { $ne: 'resolved' } }), 0);
    const stats = await call('GET', '/trips/stats', null, admin);
    assert.equal(stats.data.completed, 1);
    assert.ok(stats.data.totalDistanceKm > 0);
    assert.equal(stats.data.perDay.length, 1);
    const page = await call('GET', '/trips?page=1&limit=10', null, admin);
    assert.equal(page.data.total, 1);
    const summary = await call('GET', '/admin/summary', null, admin);
    assert.equal(summary.data.routes, 4);
    assert.equal(summary.data.pendingApplications, 2); // from the seed
  });

  await t.test('driver registration -> pending -> admin reviews documents -> approve / reject', async () => {
    const application = {
      name: 'Navjot Singh', email: 'navjot@example.com', phone: '+91 98765 43210', password: 'strongpass1',
      dateOfBirth: '1990-05-20', gender: 'male', address: 'House 5, Sector 70', city: 'Mohali', state: 'Punjab',
      licenseNumber: 'PB65 20180001111', licenseClass: 'Transport (HPMV)', licenseExpiry: '2031-01-01',
      experienceYears: 8, emergencyContact: { name: 'Simran', phone: '+91 98765 00000' }, idType: 'Voter ID',
      documents: { licenseFront: PNG, licenseBack: PNG, idProof: PNG }
    };
    assert.equal((await call('POST', '/auth/driver/register', { ...application, dateOfBirth: '2012-01-01', email: 'kid@example.com', licenseNumber: 'X1234567' })).status, 400, 'underage');
    assert.equal((await call('POST', '/auth/driver/register', { ...application, email: 'bad@example.com', licenseNumber: 'Y1234567', documents: { ...application.documents, idProof: 'data:image/png;base64,AAAA' } })).status, 400, 'invalid image');

    const newAppP = nextEvent(adminSocket, 'application:new');
    const reg = await call('POST', '/auth/driver/register', application);
    assert.equal(reg.status, 201, JSON.stringify(reg.data));
    assert.equal(reg.data.application.status, 'pending');
    assert.equal((await newAppP).name, 'Navjot Singh');

    const blocked = await call('POST', '/auth/driver/login', { email: 'navjot@example.com', password: 'strongpass1' });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.code, 'APPLICATION_PENDING');
    assert.equal((await call('GET', '/trips/driver/active', null, reg.data.applicationToken)).status, 401, 'applicant token is not a driver token');

    const list = await call('GET', '/drivers/applications?status=pending', null, admin);
    const app = list.data.applications.find((a) => a.email === 'navjot@example.com');
    assert.equal(app.documents.licenseFront, true);
    assert.equal(app.password, undefined);
    const doc = await call('GET', `/drivers/${app._id}/documents/idProof`, null, admin);
    assert.equal(doc.headers.get('content-type'), 'image/png');
    assert.ok(Buffer.isBuffer(doc.data) && doc.data.length > 0);
    assert.equal((await call('GET', `/drivers/${app._id}/documents/idProof`)).status, 401, 'documents need admin auth');

    // No body, exactly like the admin panel's Approve button (regression: Express 5 left req.body undefined).
    assert.equal((await call('POST', `/drivers/${app._id}/approve`, null, admin)).status, 200);
    const status = await call('GET', '/auth/driver/application', null, reg.data.applicationToken);
    assert.equal(status.data.status, 'approved');
    assert.equal((await call('POST', '/auth/driver/login', { email: 'navjot@example.com', password: 'strongpass1' })).status, 200);

    const other = list.data.applications.find((a) => a.email === 'manpreet.applicant@transit.local');
    assert.equal((await call('POST', `/drivers/${other._id}/reject`, {}, admin)).status, 400, 'reason required');
    assert.equal((await call('POST', `/drivers/${other._id}/reject`, { reason: 'Licence photo unreadable' }, admin)).status, 200);
    const rejected = await call('POST', '/auth/driver/login', { email: 'manpreet.applicant@transit.local', password: 'Demo@1234' });
    assert.equal(rejected.data.code, 'APPLICATION_REJECTED');
    assert.equal(rejected.data.application.reviewNote, 'Licence photo unreadable');
  });

  await t.test('suspended driver: token stops working immediately', async () => {
    const d = await models.Driver.findOne({ email: 'demo.driver2@transit.local' });
    const token = (await call('POST', '/auth/driver/login', { email: d.email, password: 'Demo@1234' })).data.token;
    assert.equal((await call('GET', '/trips/driver/active', null, token)).status, 200);
    await call('PUT', `/drivers/${d._id}`, { isActive: false }, admin);
    assert.equal((await call('GET', '/trips/driver/active', null, token)).status, 401);
    assert.equal((await call('POST', '/locations', { coordinates: STOP.isbt43 }, token)).status, 400, 'no cached trip for suspended driver');
  });

  await t.test('Google sign-in creates/links passenger accounts', async () => {
    google.setGoogleVerifierForTests(async (idToken) => {
      if (idToken === 'good-token') return { sub: 'google-123', email: 'pia@example.com', email_verified: true, name: 'Pia G', picture: 'https://x/p.png' };
      if (idToken === 'unverified') return { sub: 'google-456', email: 'u@example.com', email_verified: false };
      throw new Error('bad token');
    });
    const linked = await call('POST', '/auth/user/google', { idToken: 'good-token' });
    assert.equal(linked.status, 200);
    assert.equal(linked.data.user.email, 'pia@example.com', 'linked to the existing account');
    assert.equal((await call('POST', '/auth/user/google', { idToken: 'forged' })).status, 401);
    assert.equal((await call('POST', '/auth/user/google', { idToken: 'unverified' })).status, 401);
    const me = await call('GET', '/auth/user/me', null, linked.data.token);
    assert.equal(me.data.user.avatarUrl, 'https://x/p.png');
  });

  await t.test('admin transit editing: stops + route + generated path', async () => {
    const a = await call('POST', '/transit/stops', { name: 'Test Stop A', lat: 30.70, lng: 76.70 }, admin);
    const b = await call('POST', '/transit/stops', { name: 'Test Stop B', lat: 30.71, lng: 76.71 }, admin);
    assert.equal(a.status, 201);
    const route = await call('POST', '/transit/routes', { number: '99', name: 'Test', stops: [{ stop: a.data._id }, { stop: b.data._id }], departures: ['09:00', '08:00'] }, admin);
    assert.equal(route.status, 201, JSON.stringify(route.data));
    assert.deepEqual(route.data.departures, ['08:00', '09:00']);
    const gen = await call('POST', `/transit/routes/${route.data._id}/generate-path`, {}, admin);
    assert.equal(gen.data.source, 'straight');
    assert.equal(gen.data.route.path.coordinates.length, 2);
    assert.ok(gen.data.route.stops[1].offsetMinutes > 0, 'a route without times gets them from the travel time');
    const timed = await call('PUT', `/transit/routes/${route.data._id}`, { number: '99', name: 'Test', departures: ['08:00', '09:00'],
      stops: [{ stop: a.data._id, offsetMinutes: 0 }, { stop: b.data._id, offsetMinutes: 42 }] }, admin);
    assert.equal(timed.status, 200, JSON.stringify(timed.data));
    const regen = await call('POST', `/transit/routes/${route.data._id}/generate-path`, {}, admin);
    assert.equal(regen.data.route.stops[1].offsetMinutes, 42, 'regenerating the path keeps an existing timetable');
    assert.equal(regen.data.offsetsUpdated, false);
    assert.equal((await call('DELETE', `/transit/stops/${a.data._id}`, null, admin)).status, 400, 'stop in use');
    const journey = await call('GET', '/public/journey?fromLat=30.70&fromLng=76.70&toLat=30.71&toLng=76.71');
    assert.ok(journey.data.options.some((o) => o.legs.some((l) => l.route?.number === '99')), 'planner sees the new route');
  });

  await t.test('rate limiting on login', async () => {
    for (let i = 0; i < 10; i++) await call('POST', '/auth/user/login', { email: 'victim@example.com', password: 'x' });
    assert.equal((await call('POST', '/auth/user/login', { email: 'victim@example.com', password: 'x' })).status, 429);
    assert.equal((await call('POST', '/auth/user/login', { email: 'other@example.com', password: 'x' })).status, 401);
  });
});
