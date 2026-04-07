require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db } = require('./db');
const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const vehiclesRoutes = require('./routes/vehicles');

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
  const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.use('/api/vehicles', vehiclesRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: Set JWT_SECRET in production');
}

app.listen(PORT, () => {
  console.log(`Mecko API listening on http://localhost:${PORT}`);
});

// Export for tests
module.exports = { app };
