const User = require('../models/User');

// GET /api/users  (admin only)
const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const filter = role ? { role } : {};

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, total, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id  (admin only)
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/role  (admin only)
const updateRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['citizen', 'authority', 'admin'];
    if (!validRoles.includes(role))
      return res.status(400).json({ success: false, message: 'Invalid role.' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/toggle  (admin only)
const toggleActive = async (req, res) => {
  try {
    // Find only the specific user by ID
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found.' });

    // Toggle only this user's isActive
    user.isActive = !user.isActive;
    await user.save();

    const status = user.isActive ? 'activated' : 'deactivated';
    res.json({
      success: true,
      message: `User ${user.name} has been ${status}.`,
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/profile  (logged-in user updates own profile)
const updateProfile = async (req, res) => {
  try {
    const { name, phone, area } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, area },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllUsers, getUser, updateRole, toggleActive, updateProfile };