import express from 'express';
import Bus from '../models/Bus.js';

const router = express.Router();

// Public list of active buses for user tracking app
router.get('/buses/active', async (req, res) => {
  try {
    const { route } = req.query;
    const query = { status: { $in: ['active', 'breakdown'] } };

    if (route) {
      query.route = route;
    }

    const buses = await Bus.find(query)
      .select('busNumber plateNumber route routeCoordinates status currentLocation')
      .sort({ updatedAt: -1 });

    res.json(buses);
  } catch (error) {
    console.error('Public active buses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public route list so users can filter easily
router.get('/routes', async (req, res) => {
  try {
    const routes = await Bus.distinct('route');
    const cleanedRoutes = routes.filter(Boolean).sort((a, b) => a.localeCompare(b));
    res.json(cleanedRoutes);
  } catch (error) {
    console.error('Public routes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public bus details
router.get('/buses/:id', async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id).select(
      'busNumber plateNumber route routeCoordinates status currentLocation'
    );

    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    res.json(bus);
  } catch (error) {
    console.error('Public bus details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
