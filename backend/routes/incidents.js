import express from 'express';
import { body } from 'express-validator';
import Incident from '../models/Incident.js';
import Driver from '../models/Driver.js';
import User from '../models/User.js';
import Bus from '../models/Bus.js';
import { authenticateAdmin, optionalAuth, isDriverAllowed } from '../middleware/auth.js';
import { validate, isObjectId } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { createIncident, updateIncident, populateIncident } from '../services/incidents.js';
import * as liveTracker from '../services/liveTracker.js';
import { ALL_PANIC_REASON_IDS } from '../../shared/incidents.js';

const router = express.Router();

const TRAIL_WINDOW_MS = 15 * 60 * 1000; // passengers share live location for 15 minutes after a panic
const TRAIL_MAX_POINTS = 120;

const panicLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  key: (req) => `${req.ip}|${req.body?.deviceId || ''}`,
  message: 'Too many alerts sent. If you are in danger, call 112.'
});
const detailsLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

const location = (prefix) => [
  body(`${prefix}.lat`).isFloat({ min: -90, max: 90 }),
  body(`${prefix}.lng`).isFloat({ min: -180, max: 180 })
];

/** Who is pressing panic: an approved driver, a signed-in passenger, or an anonymous device. */
async function identify(req) {
  if (req.auth?.role === 'driver') {
    const driver = await Driver.findById(req.auth.userId).select('status isActive');
    if (isDriverAllowed(driver)) return { source: 'driver', driver: driver._id };
  }
  if (req.auth?.role === 'user' && await User.exists({ _id: req.auth.userId, isActive: true })) {
    return { source: 'passenger', user: req.auth.userId };
  }
  return { source: 'passenger', deviceId: req.body.deviceId };
}

const sameReporter = (incident, who) =>
  (who.driver && String(incident.driver) === String(who.driver)) ||
  (who.user && String(incident.user) === String(who.user)) ||
  (who.deviceId && incident.deviceId === who.deviceId);

// ---------- Panic (driver or passenger) ----------

// Sent the moment the button is held; the reason is added afterwards. No login required.
router.post('/panic', optionalAuth, panicLimiter, [
  ...location('location'),
  body('deviceId').optional().isString().isLength({ min: 8, max: 100 }),
  body('busId').optional({ values: 'null' }).custom(isObjectId),
  body('reason').optional({ values: 'null' }).isIn(ALL_PANIC_REASON_IDS),
  body('note').optional().isString().isLength({ max: 500 })
], validate, async (req, res) => {
  const who = await identify(req);
  if (!who.driver && !who.user && !who.deviceId) {
    return res.status(400).json({ message: 'deviceId is required when not signed in' });
  }
  const { lat, lng } = req.body.location;
  const data = {
    type: 'panic', ...who,
    location: { lat, lng },
    trail: [{ lat, lng, at: new Date() }],
    reason: req.body.reason || null,
    note: req.body.note || ''
  };

  if (who.driver) {
    const state = await liveTracker.getActiveTrip(who.driver);
    if (state) Object.assign(data, { bus: state.busId, trip: state.tripId });
    else data.bus = (await Driver.findById(who.driver).select('assignedBus'))?.assignedBus || null;
  } else if (req.body.busId && await Bus.exists({ _id: req.body.busId })) {
    data.bus = req.body.busId;
    data.trip = liveTracker.getLiveBus(req.body.busId)?.tripId || null;
  }

  const incident = await createIncident(data);
  res.status(201).json({ id: incident._id, status: incident.status, createdAt: incident.createdAt, busId: data.bus || null });
});

// Add the reason/note and live location updates to your own panic alert.
router.patch('/:id/details', optionalAuth, detailsLimiter, [
  body('deviceId').optional().isString(),
  body('reason').optional().isIn(ALL_PANIC_REASON_IDS),
  body('note').optional().isString().isLength({ max: 500 }),
  body('busId').optional({ values: 'null' }).custom(isObjectId),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }),
  body('location.lng').optional().isFloat({ min: -180, max: 180 })
], validate, async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  const who = await identify(req);
  if (!incident || incident.type !== 'panic' || !sameReporter(incident, who)) {
    return res.status(404).json({ message: 'Alert not found' });
  }

  const update = {};
  if (req.body.reason) update.reason = req.body.reason;
  if (req.body.note !== undefined) update.note = req.body.note;
  // Passengers pick (or correct, or clear with null) which bus they're on; a driver's bus comes from their trip.
  if (incident.source === 'passenger' && req.body.busId !== undefined) {
    if (req.body.busId === null) Object.assign(update, { bus: null, trip: null });
    else if (await Bus.exists({ _id: req.body.busId })) Object.assign(update, { bus: req.body.busId, trip: liveTracker.getLiveBus(req.body.busId)?.tripId || null });
  }
  const loc = req.body.location;
  const sharing = Date.now() - incident.createdAt.getTime() < TRAIL_WINDOW_MS && incident.status !== 'resolved';
  if (loc && sharing && incident.trail.length < TRAIL_MAX_POINTS) {
    update.$push = { trail: { lat: loc.lat, lng: loc.lng, at: new Date() } };
    update.location = { lat: loc.lat, lng: loc.lng };
  }
  const updated = await updateIncident(incident._id, update);
  res.json({ id: updated._id, status: updated.status, sharingLocation: sharing });
});

// The reporter can check whether help has acknowledged their alert.
router.get('/:id/status', optionalAuth, async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  const who = await identify({ ...req, body: { deviceId: req.query.deviceId } });
  if (!incident || !sameReporter(incident, who)) return res.status(404).json({ message: 'Alert not found' });
  res.json({ id: incident._id, status: incident.status, acknowledgedAt: incident.acknowledgedAt, resolvedAt: incident.resolvedAt });
});

// ---------- Admin ----------

router.get('/', authenticateAdmin, async (req, res) => {
  const filter = {};
  if (req.query.status === 'active') filter.status = { $ne: 'resolved' };
  else if (['open', 'acknowledged', 'resolved'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  const limit = Math.min(200, parseInt(req.query.limit) || 100);
  const [items, counts] = await Promise.all([
    populateIncident(Incident.find(filter).sort({ createdAt: -1 }).limit(limit)),
    Incident.aggregate([{ $match: { status: { $ne: 'resolved' } } }, { $group: { _id: '$status', n: { $sum: 1 } } }])
  ]);
  res.json({ items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
});

router.get('/:id', authenticateAdmin, async (req, res) => {
  const incident = await populateIncident(Incident.findById(req.params.id).populate('handledBy', 'username email'));
  if (!incident) return res.status(404).json({ message: 'Incident not found' });
  res.json(incident);
});

router.post('/:id/acknowledge', authenticateAdmin, async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  if (!incident) return res.status(404).json({ message: 'Incident not found' });
  if (incident.status !== 'open') return res.status(400).json({ message: `Incident is already ${incident.status}` });
  res.json(await updateIncident(incident._id, { status: 'acknowledged', acknowledgedAt: new Date(), handledBy: req.user._id }));
});

router.post('/:id/resolve', authenticateAdmin, [
  body('resolution').isIn(['handled', 'false-alarm']),
  body('note').optional().isString().isLength({ max: 500 })
], validate, async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  if (!incident) return res.status(404).json({ message: 'Incident not found' });
  if (incident.status === 'resolved') return res.status(400).json({ message: 'Incident is already resolved' });
  res.json(await updateIncident(incident._id, {
    status: 'resolved',
    resolution: req.body.resolution,
    resolutionNote: req.body.note || '',
    resolvedAt: new Date(),
    acknowledgedAt: incident.acknowledgedAt || new Date(),
    handledBy: req.user._id
  }));
});

export default router;
