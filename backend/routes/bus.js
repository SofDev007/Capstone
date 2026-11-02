import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateAdmin } from '../middleware/auth.js';
import Bus from '../models/Bus.js';
import Driver from '../models/Driver.js';

const router = express.Router();

// Get all buses
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate('assignedDriver', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(buses);
  } catch (error) {
    console.error('Get buses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single bus
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate('assignedDriver', 'name email phone');
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }
    res.json(bus);
  } catch (error) {
    console.error('Get bus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create bus
router.post('/', authenticateAdmin, [
  body('busNumber').notEmpty().trim(),
  body('plateNumber').notEmpty().trim(),
  body('capacity').isInt({ min: 1 }),
  body('route').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { busNumber, plateNumber, capacity, route, routeCoordinates } = req.body;

    const bus = new Bus({
      busNumber,
      plateNumber,
      capacity,
      route,
      routeCoordinates: routeCoordinates || []
    });

    await bus.save();
    res.status(201).json(bus);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Bus number or plate number already exists' });
    }
    console.error('Create bus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update bus
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { busNumber, plateNumber, capacity, route, routeCoordinates, status } = req.body;

    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    if (busNumber) bus.busNumber = busNumber;
    if (plateNumber) bus.plateNumber = plateNumber;
    if (capacity) bus.capacity = capacity;
    if (route) bus.route = route;
    if (routeCoordinates) bus.routeCoordinates = routeCoordinates;
    if (status) bus.status = status;

    await bus.save();
    res.json(bus);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Bus number or plate number already exists' });
    }
    console.error('Update bus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete bus
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    // Unassign driver if assigned
    if (bus.assignedDriver) {
      await Driver.findByIdAndUpdate(bus.assignedDriver, { assignedBus: null });
    }

    await Bus.findByIdAndDelete(req.params.id);
    res.json({ message: 'Bus deleted successfully' });
  } catch (error) {
    console.error('Delete bus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign driver to bus
router.post('/:id/assign-driver', authenticateAdmin, [
  body('driverId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { driverId } = req.body;
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Unassign previous bus from driver if any
    if (driver.assignedBus && driver.assignedBus.toString() !== req.params.id) {
      await Bus.findByIdAndUpdate(driver.assignedBus, { assignedDriver: null });
    }

    // Unassign previous driver from bus if any
    if (bus.assignedDriver && bus.assignedDriver.toString() !== driverId) {
      await Driver.findByIdAndUpdate(bus.assignedDriver, { assignedBus: null });
    }

    // Assign new driver
    bus.assignedDriver = driverId;
    driver.assignedBus = req.params.id;

    await bus.save();
    await driver.save();

    const updatedBus = await Bus.findById(req.params.id)
      .populate('assignedDriver', 'name email phone');

    res.json(updatedBus);
  } catch (error) {
    console.error('Assign driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active buses (for map)
router.get('/active/all', authenticateAdmin, async (req, res) => {
  try {
    const buses = await Bus.find({ status: 'active' })
      .populate('assignedDriver', 'name email phone')
      .select('busNumber plateNumber route currentLocation assignedDriver');
    res.json(buses);
  } catch (error) {
    console.error('Get active buses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

