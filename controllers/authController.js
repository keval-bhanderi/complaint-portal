const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { name, email, password, phone, area } = req.body;

  const existing = await User.findOne({ email });
  if (existing)
    return res.status(409).json({ success: false, message: 'Email already registered.' });

  const user = await User.create({ name, email, password, phone, area });
  const token = signToken(user._id);

  res.status(201).json({ success: true, token, user });
};

// POST /api/auth/login
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password)))
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });

  if (!user.isActive)
    return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });

  const token = signToken(user._id);
  user.password = undefined;

  res.json({ success: true, token, user });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { register, login, getMe };
