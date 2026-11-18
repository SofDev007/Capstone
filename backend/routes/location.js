import express from 'express';
import { body } from 'express-validator';
import { authenticateAdmin, verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import Location from '../models/Location.js';
import * as liveTracker from '../services/liveTracker.js';

const router = express.Router();

/**
 * Driver auth for GPS pings without a DB read: the JWT is verified cryptographically and the
 * driver's active trip comes from the live tracker cache (which evicts suspended drivers).
 */
const driverTrip = async (req, res, next) => {
  const auth = verifyToken(req.header('Authorization')?.replace('Bearer ', ''));
  if (auth?.role !== 'driver') return res.status(401).json({ message: 'Unauthorized' });
  const state = await liveTracker.getActiveTrip(auth.userId);
  if (!state) return res.status(400).json({ message: 'No active trip' });
  if (req.body.tripId && req.body.tripId !== state.tripId) {
    return res.status(400).json({ message: 'Trip is not active' });
  }
  req.tripState = state;
  next();
};

const point = (prefix) => [
  body(`${prefix}lat`).isFloat({ min: -90, max: 90 }),
  body(`${prefix}lng`).isFloat({ min: -180, max: 180 }),
  body(`${prefix}speed`).optional({ values: 'null' }).isFloat(), // m/s; null = the phone doesn't know
  body(`${prefix}heading`).optional({ values: 'null' }).isFloat()
];
const speedOf = (v) => (v == null ? null : Number(v));

// Live location update (Driver). `timestamp` = when the phone took the fix (used for speed/distance).
router.post('/', [
  ...point('coordinates.'),
  body('speed').optional({ values: 'null' }).isFloat(),
  body('heading').optional({ values: 'null' }).isFloat(),
  body('timestamp').optional().isISO8601()
], validate, driverTrip, async (req, res) => {
  const { coordinates, speed, heading, timestamp } = req.body;
  const view = await liveTracker.recordPing(req.tripState, {
    lat: Number(coordinates.lat),
    lng: Number(coordinates.lng),
    speed: speedOf(speed),
    heading: Number(heading) || 0,
    fixAt: timestamp ? Date.parse(timestamp) : undefined
  });
  res.status(201).json({ message: 'Location updated', bus: view });
});

/**
 * Points queued on the phone while offline, oldest first.
 * They go to history/distance; only a point newer than the last live one (and < 30 s old) goes live.
 */
router.post('/batch', [
  body('points').isArray({ min: 1, max: 500 }),
  ...point('points.*.'),
  body('points.*.timestamp').isISO8601()
], validate, driverTrip, async (req, res) => {
  const points = [...req.body.points].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const now = Date.now();
  for (const p of points) {
    const ts = new Date(p.timestamp).getTime();
    if (ts > now + 60000) continue; // clock skew garbage
    await liveTracker.recordPing(req.tripState, {
      lat: Number(p.lat), lng: Number(p.lng), speed: speedOf(p.speed), heading: Number(p.heading) || 0, timestamp: ts
    }, { live: now - ts < 30000 });
  }
  res.status(201).json({ message: 'Locations recorded', count: points.length });
});

// Location history for a trip (Admin), oldest first for drawing the trail
router.get('/trip/:tripId', authenticateAdmin, async (req, res) => {
  const limit = Math.min(5000, parseInt(req.query.limit) || 2000);
  const locations = await Location.find({ 'meta.trip': req.params.tripId })
    .sort({ timestamp: 1 })
    .limit(limit)
    .lean();
  res.json(locations);
});

// Recent history for a bus (Admin)
router.get('/bus/:busId', authenticateAdmin, async (req, res) => {
  const limit = Math.min(1000, parseInt(req.query.limit) || 100);
  const locations = await Location.find({ 'meta.bus': req.params.busId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
  res.json(locations);
});

export default router;
