const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { JWT_SECRET } = require('../middleware/auth');
const { generateId } = require('../lib/ids');
const User = require('../models/User');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;
  const normalized = String(email).trim().toLowerCase();
  const existing = await User.findOne({ email: normalized }).select({ _id: 1 }).lean();
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const id = generateId();
  const password_hash = bcrypt.hashSync(password, 10);
  await User.create({ _id: id, email: normalized, password_hash });
  const token = jwt.sign({ sub: id, email: normalized }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, user: { id, email: normalized } });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;
  const normalized = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalized })
    .select({ _id: 1, email: 1, password_hash: 1 })
    .lean();
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ sub: user._id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user._id, email: user.email } });
});

module.exports = router;
