import mongoose from 'mongoose';

const busSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  plateNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  route: {
    type: String,
    required: true,
    trim: true
  },
  routeCoordinates: [{
    lat: Number,
    lng: Number
  }],
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'breakdown'],
    default: 'inactive'
  },
  currentLocation: {
    lat: {
      type: Number,
      default: null
    },
    lng: {
      type: Number,
      default: null
    },
    timestamp: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true
});

const Bus = mongoose.model('Bus', busSchema);

export default Bus;

