require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const vehiclesRoutes = require('./routes/vehicles');
const { connectMongo } = require('./mongo');
const User = require('./models/User');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'mecko-api' });
});

app.use('/api/auth', authRoutes);

app.get('/api/me', authMiddleware, (req, res) => {
  void (async () => {
    const user = await User.findById(req.userId)
      .select({ _id: 1, email: 1, created_at: 1 })
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, email: user.email, created_at: user.created_at });
  })().catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });
});

app.use('/api/vehicles', vehiclesRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (process.env.NODE_ENV !== 'production') {
    res.status(500).json({ error: 'Server error', detail: err?.message || String(err) });
    return;
  }
  res.status(500).json({ error: 'Server error' });
});

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: Set JWT_SECRET in production');
}

void (async () => {
  await connectMongo();
  app.listen(PORT, () => {
    console.log(`Mecko API listening on http://localhost:${PORT}`);
  });
})().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});

// Export for tests
module.exports = { app };
