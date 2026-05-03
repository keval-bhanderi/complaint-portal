const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  createComplaint,
  getComplaints,
  getMapComplaints,
  getComplaint,
  updateStatus,
  upvoteComplaint,
  deleteComplaint,
} = require('../controllers/complaintController');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/map', getMapComplaints);
router.get('/', getComplaints);
router.post('/', upload.array('photos', 3), createComplaint);

router.get('/:id', getComplaint);
router.patch('/:id/status', authorize('authority', 'admin'), updateStatus);
router.patch('/:id/upvote', upvoteComplaint);
router.delete('/:id', deleteComplaint);

module.exports = router;
