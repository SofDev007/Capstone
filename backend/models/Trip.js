import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema({
  bus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  startLocation: {
    lat: Number,
    lng: Number
  },
  endLocation: {
    lat: Number,
    lng: Number
  },
  totalDistance: {
    type: Number,
    default: 0
  },
  delayMinutes: {
    type: Number,
    default: 0
  },
  breakdownReported: {
    type: Boolean,
    default: false
  },
  breakdownReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const Trip = mongoose.model('Trip', tripSchema);

export default Trip;

