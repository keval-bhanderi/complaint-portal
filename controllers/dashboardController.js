const Complaint = require('../models/Complaint');

// GET /api/dashboard/public-stats — no auth needed
const getPublicStats = async (req, res) => {
  try {
    const [total, resolved, open] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'resolved' }),
      Complaint.countDocuments({ status: 'open' }),
    ]);
    res.json({ success: true, stats: { total, resolved, open } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
const getStats = async (req, res) => {
  const [statusCounts, categoryCounts, recentComplaints, avgResolution] = await Promise.all([
    // Count by status
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),

    // Count by category
    Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),

    // 5 most recent complaints
    Complaint.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('submittedBy', 'name')
      .select('title status category createdAt location'),

    // Average resolution time in hours (for resolved complaints)
    Complaint.aggregate([
      { $match: { status: 'resolved', resolvedAt: { $ne: null } } },
      {
        $project: {
          diffHours: {
            $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000],
          },
        },
      },
      { $group: { _id: null, avg: { $avg: '$diffHours' } } },
    ]),
  ]);

  // Format status counts into a simple object
  const byStatus = { open: 0, 'in-progress': 0, resolved: 0, rejected: 0 };
  statusCounts.forEach(({ _id, count }) => { byStatus[_id] = count; });

  const byCategory = {};
  categoryCounts.forEach(({ _id, count }) => { byCategory[_id] = count; });

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const avgResolutionHours = avgResolution[0]?.avg
    ? Math.round(avgResolution[0].avg)
    : null;

  res.json({
    success: true,
    stats: {
      total,
      byStatus,
      byCategory,
      avgResolutionHours,
      recentComplaints,
    },
  });
};

// GET /api/dashboard/map-data — all complaints for map view
const getMapData = async (req, res) => {
  const complaints = await Complaint.find(
    {},
    'title category status location createdAt upvotes'
  ).lean();

  res.json({ success: true, complaints });
};

module.exports = { getStats, getMapData, getPublicStats };