import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateAdmin } from '../middleware/auth.js';
import Driver from '../models/Driver.js';
import Bus from '../models/Bus.js';

const router = express.Router();

// Get all drivers
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const drivers = await Driver.find()
      .populate('assignedBus', 'busNumber plateNumber route')
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(drivers);
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single driver
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('assignedBus', 'busNumber plateNumber route')
      .select('-password');
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    res.json(driver);
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create driver
router.post('/', authenticateAdmin, [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('phone').notEmpty().trim(),
  body('licenseNumber').notEmpty().trim(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, licenseNumber, password } = req.body;

    const driver = new Driver({
      name,
      email,
      phone,
      licenseNumber,
      password
    });

    await driver.save();
    const driverResponse = await Driver.findById(driver._id)
      .select('-password')
      .populate('assignedBus', 'busNumber plateNumber route');

    res.status(201).json(driverResponse);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email or license number already exists' });
    }
    console.error('Create driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update driver
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name, email, phone, licenseNumber, isActive } = req.body;

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    if (name) driver.name = name;
    if (email) driver.email = email;
    if (phone) driver.phone = phone;
    if (licenseNumber) driver.licenseNumber = licenseNumber;
    if (typeof isActive === 'boolean') driver.isActive = isActive;

    await driver.save();
    const driverResponse = await Driver.findById(driver._id)
      .select('-password')
      .populate('assignedBus', 'busNumber plateNumber route');

    res.json(driverResponse);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email or license number already exists' });
    }
    console.error('Update driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete driver
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Unassign bus if assigned
    if (driver.assignedBus) {
      await Bus.findByIdAndUpdate(driver.assignedBus, { assignedDriver: null });
    }

    await Driver.findByIdAndDelete(req.params.id);
    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

