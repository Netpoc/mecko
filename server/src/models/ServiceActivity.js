const { mongoose } = require('../mongo');

const ServiceActivitySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    vehicle_id: { type: String, required: true, index: true },
    activity_type: { type: String, required: true },
    title: { type: String, required: true },
    notes: { type: String, default: null },
    obd_codes: { type: String, default: null },
    recommendation_ref: { type: Object, default: null },
    odometer_mi: { type: Number, default: null },
    performed_at: { type: String, required: true },
    created_at: { type: String, required: true, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

ServiceActivitySchema.index({ vehicle_id: 1, performed_at: -1, created_at: -1 });

module.exports = mongoose.model('ServiceActivity', ServiceActivitySchema);

