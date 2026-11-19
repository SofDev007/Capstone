import express from 'express';
import { body } from 'express-validator';
import mongoose from 'mongoose';
import { authenticateAdmin, authenticateDriver } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import Incident from '../models/Incident.js';
import * as liveTracker from '../services/liveTracker.js';
import { createIncident, hasOpenIncident } from '../services/incidents.js';
import { getIO } from '../services/realtime.js';

const router = express.Router();

const coords = (field) => [body(`${field}.lat`).isFloat({ min: -90, max: 90 }), body(`${field}.lng`).isFloat({ min: -180, max: 180 })];

const populateTrip = (query) => query
  .populate('bus', 'busNumber plateNumber route')
  .populate('driver', 'name email phone')
  .populate('route', 'number name color');

/** Full route (ordered stops + path) for the driver's navigation screen. */
const driverTripJson = async (trip) => {
  const route = trip.route ? await liveTracker.getRoute(trip.route._id ?? trip.route) : null;
  return {
    ...trip.toJSON(),
    routeDetails: route && {
      id: route.id, number: route.number, name: route.name, color: route.color,
      stops: route.stops.map(({ id, name, lat, lng, offsetMinutes }) => ({ id, name, lat, lng, offsetMinutes })),
      path: route.index ? route.index.points.map((p) => [p.lng, p.lat]) : []
    },
    live: liveTracker.getLiveBus(trip.bus._id ?? trip.bus)
  };
};

// ---------- Driver ----------

router.post('/start', authenticateDriver, coords('startLocation'), validate, async (req, res) => {
  const driver = req.user;
  if (!driver.assignedBus) {
    return res.status(400).json({ message: 'No bus assigned to driver' });
  }
  if (await Trip.exists({ driver: driver._id, status: 'active' })) {
    return res.status(400).json({ message: 'You already have an active trip' });
  }
  const bus = await Bus.findById(driver.assignedBus);
  if (!bus) {
    return res.status(404).json({ message: 'Assigned bus not found' });
  }

  const { lat, lng } = req.body.startLocation;
  bus.status = 'active';
  bus.currentLocation = { lat, lng, timestamp: new Date() };
  await bus.save();

  const trip = new Trip({
    bus: bus._id,
    driver: driver._id,
    startTime: new Date(),
    startLocation: { lat, lng },
    status: 'active'
  });
  await liveTracker.startTrip(trip, bus); // sets trip.route + scheduledDeparture
  await trip.save();

  getIO()?.emit('trip-started', { tripId: trip._id, busId: bus._id, routeId: trip.route });
  res.status(201).json(await driverTripJson(await populateTrip(Trip.findById(trip._id))));
});

router.get('/driver/active', authenticateDriver, async (req, res) => {
  const trip = await populateTrip(Trip.findOne({ driver: req.user._id, status: 'active' }));
  res.json(trip ? await driverTripJson(trip) : null);
});

router.post('/:id/end', authenticateDriver, coords('endLocation'), validate, async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return res.status(404).json({ message: 'Trip not found' });
  if (trip.driver.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  if (trip.status !== 'active') {
    return res.status(400).json({ message: 'Trip is not active' });
  }

  const { lat, lng } = req.body.endLocation;
  const stats = await liveTracker.endTrip(req.user._id);
  trip.endTime = new Date();
  trip.endLocation = { lat, lng };
  trip.status = 'completed';
  if (stats) {
    trip.totalDistance = stats.totalDistance;
    trip.delayMinutes = stats.delayMinutes;
  }
  await trip.save();

  await Bus.updateOne({ _id: trip.bus }, {
    status: 'inactive',
    currentLocation: { lat, lng, timestamp: new Date() }
  });

  getIO()?.emit('trip-ended', { tripId: trip._id, busId: trip.bus, routeId: trip.route });
  res.json(await populateTrip(Trip.findById(trip._id)));
});

router.post('/:id/breakdown', authenticateDriver, [body('reason').trim().notEmpty().isLength({ max: 300 })], validate, async (req, res) => {
  // Not populated: a populated driver would carry private data into the response and broadcast.
  const trip = await Trip.findById(req.params.id);
  if (!trip) return res.status(404).json({ message: 'Trip not found' });
  if (trip.driver.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  if (trip.status !== 'active') {
    return res.status(400).json({ message: 'Trip is not active' });
  }

  trip.breakdownReported = true;
  trip.breakdownReason = req.body.reason;
  const bus = await Bus.findByIdAndUpdate(trip.bus, { status: 'breakdown' }, { new: true });
  await trip.save();

  // An alert for the admin's Alerts page (acknowledge / resolve), with where the bus is.
  const live = await liveTracker.getActiveTrip(req.user._id);
  const last = bus?.currentLocation;
  const at = live?.position || (last?.lat != null ? { lat: last.lat, lng: last.lng } : undefined);
  await createIncident({
    type: 'breakdown', source: 'driver', driver: trip.driver, bus: trip.bus, trip: trip._id, location: at, note: req.body.reason
  });

  // Broadcast to public clients too — no driver details
  getIO()?.emit('breakdown-alert', {
    tripId: trip._id,
    bus: bus && { _id: bus._id, busNumber: bus.busNumber },
    reason: req.body.reason
  });
  res.json({ message: 'Breakdown reported successfully', trip });
});

/**
 * Location-off warnings from the driver app (rules in shared/locationWarnings.js).
 * escalate=true means the driver ignored 2 warnings: raise an admin incident (once while open).
 */
router.post('/:id/location-warning', authenticateDriver, [
  body('count').isInt({ min: 0, max: 100 }),
  body('escalate').optional().isBoolean(),
  body('location.lat').optional().isFloat(),
  body('location.lng').optional().isFloat()
], validate, async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip || trip.driver.toString() !== req.user._id.toString()) {
    return res.status(404).json({ message: 'Trip not found' });
  }
  if (trip.status !== 'active') return res.status(400).json({ message: 'Trip is not active' });

  trip.locationWarnings = Math.max(trip.locationWarnings, req.body.count);
  await trip.save();

  let incident = null;
  if (req.body.escalate && !(await hasOpenIncident(trip._id, 'location-off'))) {
    const live = liveTracker.getLiveBus(trip.bus);
    incident = await createIncident({
      type: 'location-off', source: 'system', driver: trip.driver, bus: trip.bus, trip: trip._id,
      location: req.body.location || live?.location || null,
      note: `Driver kept location off after ${trip.locationWarnings} warnings`
    });
  }
  res.json({ locationWarnings: trip.locationWarnings, escalated: Boolean(incident) });
});

// ---------- Admin ----------

const dateRange = ({ startDate, endDate }) => {
  const range = {};
  if (startDate) range.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) end.setUTCHours(23, 59, 59, 999); // whole day
    range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
};

// Paginated trip list: { items, total, page, pages }
router.get('/', authenticateAdmin, async (req, res) => {
  const { status, driverId, busId } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
  const query = {};
  if (status) query.status = status;
  if (driverId) query.driver = driverId;
  if (busId) query.bus = busId;
  const range = dateRange(req.query);
  if (range) query.startTime = range;

  const [items, total] = await Promise.all([
    populateTrip(Trip.find(query).sort({ startTime: -1 }).skip((page - 1) * limit).limit(limit)),
    Trip.countDocuments(query)
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

// Aggregated stats over ALL matching trips (not just one page).
router.get('/stats', authenticateAdmin, async (req, res) => {
  const match = {};
  const range = dateRange(req.query);
  if (range) match.startTime = range;
  const tz = process.env.TRANSIT_TIMEZONE || 'Asia/Kolkata';

  const [summary] = await Trip.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        breakdowns: { $sum: { $cond: ['$breakdownReported', 1, 0] } },
        totalDistance: { $sum: '$totalDistance' },
        avgDurationMs: {
          $avg: { $cond: [{ $and: ['$endTime', { $eq: ['$status', 'completed'] }] }, { $subtract: ['$endTime', '$startTime'] }, null] }
        },
        avgDelay: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$delayMinutes', null] } },
        onTime: {
          $sum: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $ne: ['$scheduledDeparture', null] }, { $lte: ['$delayMinutes', 5] }] }, 1, 0] }
        },
        scheduled: {
          $sum: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $ne: ['$scheduledDeparture', null] }] }, 1, 0] }
        }
      }
    }
  ]);

  const perDay = await Trip.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime', timezone: tz } }, trips: { $sum: 1 }, distance: { $sum: '$totalDistance' } } },
    { $sort: { _id: 1 } },
    { $limit: 90 }
  ]);

  const incidentMatch = {};
  if (range) incidentMatch.createdAt = range;
  const incidents = await Incident.aggregate([
    { $match: incidentMatch },
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);

  const s = summary || {};
  res.json({
    total: s.total || 0,
    completed: s.completed || 0,
    active: s.active || 0,
    breakdowns: s.breakdowns || 0,
    totalDistanceKm: Math.round((s.totalDistance || 0) / 100) / 10,
    avgDurationMinutes: s.avgDurationMs ? Math.round(s.avgDurationMs / 60000) : 0,
    avgDelayMinutes: s.avgDelay != null ? Math.round(s.avgDelay * 10) / 10 : null,
    onTimePercent: s.scheduled ? Math.round((s.onTime / s.scheduled) * 100) : null,
    perDay: perDay.map((d) => ({ date: d._id, trips: d.trips, distanceKm: Math.round(d.distance / 100) / 10 })),
    incidentsByType: Object.fromEntries(incidents.map((i) => [i._id, i.count]))
  });
});

router.get('/active/all', authenticateAdmin, async (req, res) => {
  const trips = await populateTrip(Trip.find({ status: 'active' }).sort({ startTime: -1 }));
  res.json(trips.map((t) => ({ ...t.toJSON(), live: liveTracker.getLiveBus(t.bus._id) })));
});

router.get('/:id', authenticateAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
  const trip = await populateTrip(Trip.findById(req.params.id));
  if (!trip) return res.status(404).json({ message: 'Trip not found' });
  res.json(trip);
});

export default router;
