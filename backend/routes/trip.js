import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateAdmin, authenticateDriver } from '../middleware/auth.js';
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import Driver from '../models/Driver.js';

const router = express.Router();

// Start trip (Driver)
router.post('/start', authenticateDriver, [
  body('startLocation.lat').isFloat(),
  body('startLocation.lng').isFloat()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const driver = req.user;
    if (!driver.assignedBus) {
      return res.status(400).json({ message: 'No bus assigned to driver' });
    }

    // Check if there's an active trip
    const activeTrip = await Trip.findOne({
      driver: driver._id,
      status: 'active'
    });

    if (activeTrip) {
      return res.status(400).json({ message: 'You already have an active trip' });
    }

    const bus = await Bus.findById(driver.assignedBus);
    if (!bus) {
      return res.status(404).json({ message: 'Assigned bus not found' });
    }

    // Update bus status
    bus.status = 'active';
    bus.currentLocation = {
      lat: req.body.startLocation.lat,
      lng: req.body.startLocation.lng,
      timestamp: new Date()
    };
    await bus.save();

    // Create trip
    const trip = new Trip({
      bus: bus._id,
      driver: driver._id,
      startTime: new Date(),
      startLocation: req.body.startLocation,
      status: 'active'
    });

    await trip.save();

    const tripResponse = await Trip.findById(trip._id)
      .populate('bus', 'busNumber plateNumber route')
      .populate('driver', 'name email phone');

    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('trip-started', tripResponse);
    io.to(`bus-${bus._id}`).emit('location-update', {
      busId: bus._id,
      location: bus.currentLocation
    });

    res.status(201).json(tripResponse);
  } catch (error) {
    console.error('Start trip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// End trip (Driver)
router.post('/:id/end', authenticateDriver, [
  body('endLocation.lat').isFloat(),
  body('endLocation.lng').isFloat()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const trip = await Trip.findById(req.params.id)
      .populate('bus')
      .populate('driver');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.driver._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (trip.status !== 'active') {
      return res.status(400).json({ message: 'Trip is not active' });
    }

    trip.endTime = new Date();
    trip.endLocation = req.body.endLocation;
    trip.status = 'completed';

    // Update bus status
    const bus = await Bus.findById(trip.bus._id);
    if (bus) {
      bus.status = 'inactive';
      bus.currentLocation = {
        lat: req.body.endLocation.lat,
        lng: req.body.endLocation.lng,
        timestamp: new Date()
      };
      await bus.save();
    }

    await trip.save();

    const tripResponse = await Trip.findById(trip._id)
      .populate('bus', 'busNumber plateNumber route')
      .populate('driver', 'name email phone');

    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('trip-ended', tripResponse);

    res.json(tripResponse);
  } catch (error) {
    console.error('End trip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Report breakdown (Driver)
router.post('/:id/breakdown', authenticateDriver, [
  body('reason').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const trip = await Trip.findById(req.params.id)
      .populate('bus')
      .populate('driver');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.driver._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    trip.breakdownReported = true;
    trip.breakdownReason = req.body.reason;

    // Update bus status
    const bus = await Bus.findById(trip.bus._id);
    if (bus) {
      bus.status = 'breakdown';
      await bus.save();
    }

    await trip.save();

    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('breakdown-alert', {
      trip: trip,
      bus: bus,
      driver: trip.driver,
      reason: req.body.reason
    });

    res.json({ message: 'Breakdown reported successfully', trip });
  } catch (error) {
    console.error('Report breakdown error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all trips (Admin)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { status, driverId, busId, startDate, endDate } = req.query;
    const query = {};

    if (status) query.status = status;
    if (driverId) query.driver = driverId;
    if (busId) query.bus = busId;
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const trips = await Trip.find(query)
      .populate('bus', 'busNumber plateNumber route')
      .populate('driver', 'name email phone')
      .sort({ startTime: -1 })
      .limit(100);

    res.json(trips);
  } catch (error) {
    console.error('Get trips error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single trip
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('bus', 'busNumber plateNumber route')
      .populate('driver', 'name email phone');
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.json(trip);
  } catch (error) {
    console.error('Get trip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active trips (Admin)
router.get('/active/all', authenticateAdmin, async (req, res) => {
  try {
    const trips = await Trip.find({ status: 'active' })
      .populate('bus', 'busNumber plateNumber route currentLocation')
      .populate('driver', 'name email phone')
      .sort({ startTime: -1 });

    res.json(trips);
  } catch (error) {
    console.error('Get active trips error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get driver's active trip
router.get('/driver/active', authenticateDriver, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      driver: req.user._id,
      status: 'active'
    })
      .populate('bus', 'busNumber plateNumber route routeCoordinates')
      .populate('driver', 'name email phone');

    res.json(trip || null);
  } catch (error) {
    console.error('Get driver active trip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

