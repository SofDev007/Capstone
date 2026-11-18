// Demo data per city: stops, routes with timetables, buses, approved drivers and two pending
// driver applications. Idempotent (upserts by name/number/email). One city per database:
// route numbers repeat across cities.
//   indore:     data/indore.json (12 routes from bus_routes.csv; stops marked 'approx' were estimated)
//   chandigarh: below (used by the tests)
// Usage: node scripts/seed.js [--city=indore|chandigarh]   (uses MONGODB_URI from .env)
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Stop from '../models/Stop.js';
import Route from '../models/Route.js';
import Bus from '../models/Bus.js';
import Driver from '../models/Driver.js';
import { getDirections } from '../services/routing.js';
import { saveDocument, parseImageDataUrl } from '../services/storage.js';

// Set DEMO_DRIVER_PASSWORD when seeding a public server: the default is in the README.
export const DEMO_DRIVER_PASSWORD = process.env.DEMO_DRIVER_PASSWORD || 'Demo@1234';

const STOPS = {
  isbt43: ['ISBT Sector 43', 30.7186, 76.7509],
  sec35: ['Sector 35 Market', 30.7247, 76.7608],
  sec34: ['Sector 34 Piccadily', 30.7220, 76.7730],
  sec22: ['Sector 22 Aroma Chowk', 30.7337, 76.7742],
  isbt17: ['ISBT Sector 17', 30.7408, 76.7846],
  matka: ['Matka Chowk', 30.7478, 76.7956],
  rockGarden: ['Rock Garden', 30.7525, 76.8072],
  sukhna: ['Sukhna Lake', 30.7426, 76.8183],
  capitol: ['Capitol Complex', 30.7590, 76.8040],
  pgi: ['PGI Chandigarh', 30.7649, 76.7752],
  pu: ['Panjab University', 30.7600, 76.7670],
  sec15: ['Sector 15 Market', 30.7520, 76.7740],
  tribune: ['Tribune Chowk', 30.7271, 76.7958],
  transport: ['Transport Chowk', 30.7180, 76.8001],
  elante: ['Elante Mall', 30.7057, 76.8013],
  railway: ['Chandigarh Railway Station', 30.7020, 76.8217],
  hallomajra: ['Hallo Majra', 30.6820, 76.8190],
  zirakpur: ['Zirakpur Chowk', 30.6425, 76.8173],
  mohali7: ['Mohali Phase 7', 30.7064, 76.7208],
  mohali3b2: ['Mohali Phase 3B2', 30.7166, 76.7348]
};

const every = (startHour, endHour, minutes) => {
  const out = [];
  for (let t = startHour * 60; t <= endHour * 60; t += minutes) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return out;
};

const ROUTES = [
  { number: '1', name: 'ISBT 43 – Sukhna Lake', color: '#17633F', stops: ['isbt43', 'sec35', 'sec22', 'isbt17', 'matka', 'rockGarden', 'sukhna'], departures: every(6, 21, 20) },
  { number: '2', name: 'Mohali – Railway Station', color: '#7A5600', stops: ['mohali7', 'mohali3b2', 'isbt43', 'sec34', 'tribune', 'transport', 'elante', 'railway'], departures: every(6, 21, 30) },
  { number: '3', name: 'PGI – Zirakpur', color: '#5B3A9E', stops: ['pgi', 'pu', 'sec15', 'isbt17', 'tribune', 'hallomajra', 'zirakpur'], departures: every(6, 21, 30) },
  { number: '4', name: 'Capitol Complex – ISBT 43', color: '#A3184A', stops: ['capitol', 'matka', 'isbt17', 'sec22', 'sec35', 'isbt43'], departures: every(7, 20, 40) }
];

const BUSES = [
  { busNumber: '101', plateNumber: 'CH01-G-1101', capacity: 52, route: '1', driver: 'demo.driver1@transit.local', name: 'Harpreet Singh' },
  { busNumber: '201', plateNumber: 'PB65-AK-2201', capacity: 48, route: '2', driver: 'demo.driver2@transit.local', name: 'Ravi Kumar' },
  { busNumber: '301', plateNumber: 'CH01-G-3301', capacity: 52, route: '3', driver: 'demo.driver3@transit.local', name: 'Gurdeep Kaur' },
  { busNumber: '401', plateNumber: 'CH01-G-4401', capacity: 40, route: '4', driver: 'demo.driver4@transit.local', name: 'Amit Sharma' }
];

// 1x1 PNG placeholder used as "document photos" for the demo applications.
const PLACEHOLDER_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const APPLICANTS = [
  { name: 'Manpreet Gill', email: 'manpreet.applicant@transit.local', phone: '+91 98140 11111', city: 'Mohali', licenseNumber: 'PB6520190012345', experienceYears: 7 },
  { name: 'Suresh Yadav', email: 'suresh.applicant@transit.local', phone: '+91 98720 22222', city: 'Panchkula', licenseNumber: 'HR0320150067890', experienceYears: 12 }
];

const CITIES = {
  chandigarh: { stops: STOPS, routes: ROUTES, buses: BUSES, applicants: APPLICANTS, state: 'Punjab' },
  indore: JSON.parse(readFileSync(new URL('../data/indore.json', import.meta.url)))
};

export async function seed({ city = 'indore', log = console.log } = {}) {
  if (!CITIES[city]) throw new Error(`Unknown city "${city}" (${Object.keys(CITIES).join(', ')})`);
  const { stops: STOPS, routes: ROUTES, buses: BUSES, applicants: APPLICANTS, state } = CITIES[city];
  const stopIds = {};
  for (const [key, [name, lat, lng]] of Object.entries(STOPS)) {
    const stop = await Stop.findOneAndUpdate(
      { name },
      { name, location: { type: 'Point', coordinates: [lng, lat] } },
      { upsert: true, new: true }
    );
    stopIds[key] = stop._id;
  }
  log(`Stops: ${Object.keys(stopIds).length}`);

  const routeIds = {};
  for (const r of ROUTES) {
    const points = r.stops.map((k) => ({ lat: STOPS[k][1], lng: STOPS[k][2] }));
    const directions = await getDirections(points);
    let minutes = 0;
    // Timetabled cities give minutes from the first stop; otherwise use driving time + 30 s per stop.
    const stops = r.stops.map((k, i) => {
      if (i > 0) minutes += directions.legs[i - 1].duration / 60 + 0.5;
      return { stop: stopIds[k], offsetMinutes: r.offsets ? r.offsets[i] : Math.round(minutes) };
    });
    const route = await Route.findOneAndUpdate(
      { number: r.number },
      {
        number: r.number, name: r.name, color: r.color, stops, departures: r.departures,
        path: { type: 'LineString', coordinates: directions.coordinates }, pathSource: directions.source
      },
      { upsert: true, new: true }
    );
    routeIds[r.number] = route._id;
    log(`Route ${r.number}: ${r.stops.length} stops, path from ${directions.source}`);
  }

  for (const b of BUSES) {
    const bus = await Bus.findOneAndUpdate(
      { busNumber: b.busNumber },
      { $set: { plateNumber: b.plateNumber, capacity: b.capacity, route: routeIds[b.route] }, $setOnInsert: { status: 'inactive' } },
      { upsert: true, new: true }
    );
    let driver = await Driver.findOne({ email: b.driver });
    if (!driver) {
      driver = await Driver.create({
        name: b.name, email: b.driver, phone: b.phone || '+91 90000 0000' + b.busNumber[0],
        licenseNumber: `DEMO-${b.busNumber}`, password: DEMO_DRIVER_PASSWORD, status: 'approved'
      });
    }
    driver.assignedBus = bus._id;
    await driver.save();
    bus.assignedDriver = driver._id;
    await bus.save();
  }
  log(`Buses + drivers: ${BUSES.length} (password ${DEMO_DRIVER_PASSWORD})`);

  for (const a of APPLICANTS) {
    if (await Driver.exists({ email: a.email })) continue;
    const doc = await saveDocument(parseImageDataUrl(PLACEHOLDER_PNG));
    await Driver.create({
      ...a, password: DEMO_DRIVER_PASSWORD, status: 'pending', state,
      address: `House 12, ${a.city}`, dateOfBirth: new Date('1988-04-12'), gender: 'male',
      licenseClass: 'Transport (HPMV)', licenseExpiry: new Date(Date.now() + 3 * 365 * 86400000),
      emergencyContact: { name: 'Family contact', phone: '+91 98000 00000' }, idType: 'Voter ID',
      documents: { licenseFront: doc, licenseBack: doc, idProof: doc }
    });
  }
  log(`Pending applications: ${APPLICANTS.length}`);
  return { stopIds, routeIds, drivers: BUSES.map((b) => b.driver) };
}

export const cityArg = () => process.argv.find((a) => a.startsWith('--city='))?.slice(7);

// Run directly: node scripts/seed.js [--city=...]
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/seed.js')) {
  dotenv.config();
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/transport_tracking');
  await seed({ city: cityArg() });
  await mongoose.disconnect();
}
