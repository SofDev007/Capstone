import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Driver from '../models/Driver.js';
import User from '../models/User.js';

export const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.userId).select('-password');

    if (!admin || admin.role !== 'admin') {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = admin;
    req.userType = 'admin';
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const authenticateDriver = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const driver = await Driver.findById(decoded.userId).select('-password');

    if (!driver) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = driver;
    req.userType = 'driver';
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user || user.role !== 'user' || !user.isActive) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = user;
    req.userType = 'user';
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

