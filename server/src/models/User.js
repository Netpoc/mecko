const { mongoose } = require('../mongo');

const UserSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password_hash: { type: String, required: true },
    created_at: { type: String, required: true, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

module.exports = mongoose.model('User', UserSchema);

