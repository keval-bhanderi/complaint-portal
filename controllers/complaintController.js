const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { sendMail, statusUpdateEmail } = require('../utils/mailer');

// POST /api/complaints
const createComplaint = async (req, res) => {
  const { title, description, category, address, lat, lng, priority } = req.body;

  const photos = req.files
    ? req.files.map((f) => ({ url: f.path, publicId: f.filename }))
    : [];

  const complaint = await Complaint.create({
    title,
    description,
    category,
    location: { address, lat: parseFloat(lat), lng: parseFloat(lng) },
    photos,
    priority: priority || 'medium',
    submittedBy: req.user._id,
    timeline: [{ status: 'open', note: 'Complaint submitted.', changedBy: req.user._id }],
  });

  await complaint.populate('submittedBy', 'name email');
  res.status(201).json({ success: true, complaint });
};

// GET /api/complaints
const getComplaints = async (req, res) => {
  const { status, category, priority, page = 1, limit = 10, search } = req.query;

  const filter = {};

  // Citizens only see their own complaints
  if (req.user.role === 'citizen') filter.submittedBy = req.user._id;

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (priority) filter.priority = priority;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const total = await Complaint.countDocuments(filter);
  const complaints = await Complaint.find(filter)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    complaints,
  });
};

// GET /api/complaints/map  — returns minimal data for map pins
const getMapComplaints = async (req, res) => {
  const filter = {};
  if (req.user.role === 'citizen') filter.submittedBy = req.user._id;

  const complaints = await Complaint.find(filter, 'title category status location createdAt').lean();
  res.json({ success: true, complaints });
};

// GET /api/complaints/:id
const getComplaint = async (req, res) => {
  const complaint = await Complaint.findById(req.params.id)
    .populate('submittedBy', 'name email phone')
    .populate('assignedTo', 'name email')
    .populate('timeline.changedBy', 'name role');

  if (!complaint)
    return res.status(404).json({ success: false, message: 'Complaint not found.' });

  // Citizens can only view their own
  if (
    req.user.role === 'citizen' &&
    complaint.submittedBy._id.toString() !== req.user._id.toString()
  )
    return res.status(403).json({ success: false, message: 'Access denied.' });

  res.json({ success: true, complaint });
};

// PATCH /api/complaints/:id/status
const updateStatus = async (req, res) => {
  const { status, note, assignedTo } = req.body;
  const validStatuses = ['open', 'in-progress', 'resolved', 'rejected'];

  if (!validStatuses.includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status.' });

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint)
    return res.status(404).json({ success: false, message: 'Complaint not found.' });

  complaint.status = status;
  if (assignedTo) complaint.assignedTo = assignedTo;

  complaint.timeline.push({
    status,
    note: note || '',
    changedBy: req.user._id,
  });

  await complaint.save();

  // Notify citizen via email
  const citizen = await User.findById(complaint.submittedBy);
  if (citizen) {
    await sendMail({
      to: citizen.email,
      subject: `Your complaint status updated to: ${status}`,
      html: statusUpdateEmail(complaint, status),
    });
  }

  await complaint.populate('submittedBy', 'name email');
  await complaint.populate('assignedTo', 'name email');
  res.json({ success: true, complaint });
};

// PATCH /api/complaints/:id/upvote
const upvoteComplaint = async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint)
    return res.status(404).json({ success: false, message: 'Complaint not found.' });

  const idx = complaint.upvotes.indexOf(req.user._id);
  if (idx === -1) {
    complaint.upvotes.push(req.user._id);
  } else {
    complaint.upvotes.splice(idx, 1);
  }

  await complaint.save();
  res.json({ success: true, upvoteCount: complaint.upvotes.length });
};

// DELETE /api/complaints/:id  (admin only or own open complaint)
const deleteComplaint = async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint)
    return res.status(404).json({ success: false, message: 'Complaint not found.' });

  const isOwner = complaint.submittedBy.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin)
    return res.status(403).json({ success: false, message: 'Access denied.' });

  if (isOwner && !isAdmin && complaint.status !== 'open')
    return res.status(400).json({ success: false, message: 'Cannot delete a complaint that is already being processed.' });

  await complaint.deleteOne();
  res.json({ success: true, message: 'Complaint deleted.' });
};

module.exports = {
  createComplaint,
  getComplaints,
  getMapComplaints,
  getComplaint,
  updateStatus,
  upvoteComplaint,
  deleteComplaint,
};
