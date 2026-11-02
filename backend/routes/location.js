import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateDriver, authenticateAdmin } from '../middleware/auth.js';
import Location from '../models/Location.js';
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';

const router = express.Router();

// Send location update (Driver)
router.post('/', authenticateDriver, [
  body('coordinates.lat').isFloat(),
  body('coordinates.lng').isFloat(),
  body('tripId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { coordinates, tripId, speed, heading } = req.body;
    const driver = req.user;

    // Verify trip belongs to driver
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (trip.status !== 'active') {
      return res.status(400).json({ message: 'Trip is not active' });
    }

    // Save location
    const location = new Location({
      trip: tripId,
      bus: trip.bus,
      driver: driver._id,
      coordinates: {
        lat: coordinates.lat,
        lng: coordinates.lng
      },
      speed: speed || 0,
      heading: heading || 0
    });

    await location.save();

    // Update bus current location
    const bus = await Bus.findById(trip.bus);
    if (bus) {
      bus.currentLocation = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        timestamp: new Date()
      };
      await bus.save();
    }

    // Emit WebSocket event
    const io = req.app.get('io');
    io.to(`bus-${trip.bus}`).emit('location-update', {
      busId: trip.bus,
      location: {
        lat: coordinates.lat,
        lng: coordinates.lng,
        timestamp: new Date()
      },
      speed: speed || 0,
      heading: heading || 0
    });

    res.status(201).json({ message: 'Location updated', location });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get location history for a trip (Admin)
router.get('/trip/:tripId', authenticateAdmin, async (req, res) => {
  try {
    const { limit = 1000 } = req.query;
    const locations = await Location.find({ trip: req.params.tripId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(locations);
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent locations for a bus (Admin)
router.get('/bus/:busId', authenticateAdmin, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const locations = await Location.find({ bus: req.params.busId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(locations);
  } catch (error) {
    console.error('Get bus locations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

