const { mongoose } = require('../mongo');

const MileageEntrySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    vehicle_id: { type: String, required: true, index: true },
    odometer_mi: { type: Number, required: true },
    recorded_at: { type: String, required: true, default: () => new Date().toISOString() },
    note: { type: String, default: null },
  },
  { versionKey: false }
);

MileageEntrySchema.index({ vehicle_id: 1, recorded_at: -1 });

module.exports = mongoose.model('MileageEntry', MileageEntrySchema);

