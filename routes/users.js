const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getAllUsers,
  getUser,
  updateRole,
  toggleActive,
  updateProfile,
} = require('../controllers/userController');

const router = express.Router();

router.use(protect);

router.patch('/profile', updateProfile);

// Admin-only routes
router.get('/', authorize('admin'), getAllUsers);
router.get('/:id', authorize('admin'), getUser);
router.patch('/:id/role', authorize('admin'), updateRole);
router.patch('/:id/toggle', authorize('admin'), toggleActive);

module.exports = router;
