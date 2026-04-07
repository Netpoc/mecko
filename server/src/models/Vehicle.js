const { mongoose } = require('../mongo');

const VehicleSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    user_id: { type: String, required: true, index: true },
    nickname: { type: String, required: true },
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    current_odometer_mi: { type: Number, required: true, default: 0 },
    last_mileage_at: { type: String, default: null },
    last_service_odometer_mi: { type: Number, default: null },
    last_service_date: { type: String, default: null },
    created_at: { type: String, required: true, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Vehicle', VehicleSchema);

