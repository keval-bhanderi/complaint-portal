const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getStats, getMapData, getPublicStats } = require('../controllers/dashboardController');

const router = express.Router();

// Public route — no auth needed for home page stats
router.get('/public-stats', getPublicStats);

router.use(protect);
router.use(authorize('authority', 'admin'));

router.get('/stats', getStats);
router.get('/map-data', getMapData);

module.exports = router;