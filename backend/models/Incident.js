import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
  at: { type: Date, default: Date.now }
}, { _id: false });

// Everything that needs the admin's attention: panic presses and system flags.
const incidentSchema = new mongoose.Schema({
  type: { type: String, enum: ['panic', 'breakdown', 'location-off', 'off-route', 'signal-lost'], required: true },
  source: { type: String, enum: ['driver', 'passenger', 'system'], required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deviceId: { type: String, default: null }, // anonymous passengers
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', default: null },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  location: { lat: Number, lng: Number },
  trail: { type: [pointSchema], default: [] }, // live location shared after a panic
  reason: { type: String, default: null },
  note: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
  resolution: { type: String, enum: ['handled', 'false-alarm', 'auto', null], default: null },
  resolutionNote: { type: String, default: '' },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  acknowledgedAt: Date,
  resolvedAt: Date
}, { timestamps: true });

incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ trip: 1, type: 1, status: 1 });

const Incident = mongoose.model('Incident', incidentSchema);
export default Incident;
