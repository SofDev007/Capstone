import express from 'express';
import { body } from 'express-validator';
import Stop from '../models/Stop.js';
import Route from '../models/Route.js';
import Bus from '../models/Bus.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { validate, isObjectId } from '../middleware/validate.js';
import { getDirections } from '../services/routing.js';
import { invalidateRoute } from '../services/liveTracker.js';
import { invalidateGraph } from '../services/journeyPlanner.js';

const router = express.Router();
router.use(authenticateAdmin);

/** Routes/stops changed: drop cached route geometry and the journey-planner graph. */
const changed = (routeId) => {
  invalidateRoute(routeId);
  invalidateGraph();
};

const populateRoute = (query) => query.populate('stops.stop');

// ---------- Stops ----------

const stopFields = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Stop name is required'),
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 }),
  body('code').optional().trim().isLength({ max: 20 }),
  body('names').optional().isObject()
];

router.get('/stops', async (req, res) => {
  const stops = await Stop.find().sort({ name: 1 }).limit(5000);
  res.json(stops);
});

router.post('/stops', stopFields, validate, async (req, res) => {
  const { name, lat, lng, code, names } = req.body;
  const stop = await Stop.create({ name, code, names, location: { type: 'Point', coordinates: [Number(lng), Number(lat)] } });
  changed();
  res.status(201).json(stop);
});

router.put('/stops/:id', stopFields, validate, async (req, res) => {
  const { name, lat, lng, code, names } = req.body;
  const stop = await Stop.findByIdAndUpdate(req.params.id, {
    name, code, names, location: { type: 'Point', coordinates: [Number(lng), Number(lat)] }
  }, { new: true });
  if (!stop) return res.status(404).json({ message: 'Stop not found' });
  changed();
  res.json(stop);
});

router.delete('/stops/:id', async (req, res) => {
  const used = await Route.find({ 'stops.stop': req.params.id }).select('number');
  if (used.length) {
    return res.status(400).json({ message: `Stop is used by route ${used.map((r) => r.number).join(', ')}` });
  }
  const stop = await Stop.findByIdAndDelete(req.params.id);
  if (!stop) return res.status(404).json({ message: 'Stop not found' });
  changed();
  res.json({ message: 'Stop deleted' });
});

// ---------- Routes ----------

const routeFields = [
  body('number').trim().isLength({ min: 1, max: 20 }).withMessage('Route number is required'),
  body('name').optional().trim().isLength({ max: 100 }),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/),
  body('stops').optional().isArray({ max: 200 }),
  body('stops.*.stop').custom(isObjectId),
  body('stops.*.offsetMinutes').optional().isFloat({ min: 0, max: 1440 }),
  body('departures').optional().isArray({ max: 200 }),
  body('departures.*').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Departures must be HH:MM')
];

const pickRoute = ({ number, name, color, stops, departures }) => {
  const doc = { number, name, color };
  if (stops) doc.stops = stops.map((s) => ({ stop: s.stop, offsetMinutes: Number(s.offsetMinutes) || 0 }));
  if (departures) doc.departures = [...new Set(departures)].sort();
  return doc;
};

router.get('/routes', async (req, res) => {
  const routes = await Route.find().sort({ number: 1 }).lean();
  const busCounts = await Bus.aggregate([{ $group: { _id: '$route', n: { $sum: 1 } } }]);
  const counts = Object.fromEntries(busCounts.map((b) => [String(b._id), b.n]));
  res.json(routes.map((r) => ({
    ...r,
    path: undefined,
    hasPath: r.path?.coordinates?.length >= 2,
    stopsCount: r.stops.length,
    busCount: counts[String(r._id)] || 0
  })));
});

router.get('/routes/:id', async (req, res) => {
  const route = await populateRoute(Route.findById(req.params.id));
  if (!route) return res.status(404).json({ message: 'Route not found' });
  res.json(route);
});

router.post('/routes', routeFields, validate, async (req, res) => {
  try {
    const route = await Route.create(pickRoute(req.body));
    changed(route._id);
    res.status(201).json(await populateRoute(Route.findById(route._id)));
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Route number already exists' });
    throw error;
  }
});

router.put('/routes/:id', routeFields, validate, async (req, res) => {
  const route = await Route.findById(req.params.id);
  if (!route) return res.status(404).json({ message: 'Route not found' });
  const before = route.stops.map((s) => String(s.stop)).join(',');
  Object.assign(route, pickRoute(req.body));
  // Stops changed: the old road path no longer matches.
  if (req.body.stops && route.stops.map((s) => String(s.stop)).join(',') !== before) {
    route.path = { type: 'LineString', coordinates: [] };
    route.pathSource = 'straight';
  }
  try {
    await route.save();
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Route number already exists' });
    throw error;
  }
  changed(route._id);
  res.json(await populateRoute(Route.findById(route._id)));
});

router.delete('/routes/:id', async (req, res) => {
  if (await Bus.exists({ route: req.params.id })) {
    return res.status(400).json({ message: 'Unassign buses from this route first' });
  }
  const route = await Route.findByIdAndDelete(req.params.id);
  if (!route) return res.status(404).json({ message: 'Route not found' });
  changed(route._id);
  res.json({ message: 'Route deleted' });
});

/**
 * Generate the road path through all stops (OpenRouteService, or straight lines without a key).
 * Stop times are filled from the travel times (+30 s dwell per stop) only for a route that has none
 * yet, or with updateOffsets: true; a route's timetable (e.g. imported from a CSV) is kept.
 */
router.post('/routes/:id/generate-path', [body('updateOffsets').optional().isBoolean()], validate, async (req, res) => {
  const route = await populateRoute(Route.findById(req.params.id));
  if (!route) return res.status(404).json({ message: 'Route not found' });
  const points = route.stops.filter((s) => s.stop).map((s) => ({
    lat: s.stop.location.coordinates[1], lng: s.stop.location.coordinates[0]
  }));
  if (points.length < 2) return res.status(400).json({ message: 'Add at least two stops first' });

  const directions = await getDirections(points);
  route.path = { type: 'LineString', coordinates: directions.coordinates };
  route.pathSource = directions.source;
  const updateOffsets = req.body.updateOffsets ?? route.stops.every((s) => !s.offsetMinutes);
  if (updateOffsets) {
    let minutes = 0;
    route.stops.forEach((s, i) => {
      if (i > 0) minutes += (directions.legs[i - 1]?.duration || 0) / 60 + 0.5;
      s.offsetMinutes = Math.round(minutes);
    });
  }
  await route.save();
  changed(route._id);
  res.json({
    route: await populateRoute(Route.findById(route._id)),
    source: directions.source, distance: directions.distance, offsetsUpdated: updateOffsets,
    routingError: directions.routingError // set when a key is configured but OpenRouteService refused
  });
});

export default router;
