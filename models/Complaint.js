const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'rejected'],
      required: true,
    },
    note: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const complaintSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['pothole', 'garbage', 'streetlight', 'water', 'drainage', 'noise', 'other'],
    },
    location: {
      address: { type: String, required: [true, 'Address is required'], trim: true },
      lat: { type: Number, required: [true, 'Latitude is required'] },
      lng: { type: Number, required: [true, 'Longitude is required'] },
    },
    photos: [
      {
        url: String,
        publicId: String,
      },
    ],
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'rejected'],
      default: 'open',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    timeline: [timelineSchema],
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Auto-set resolvedAt when status is set to resolved
complaintSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  next();
});

// Virtual for upvote count
complaintSchema.virtual('upvoteCount').get(function () {
  return this.upvotes ? this.upvotes.length : 0;
});

complaintSchema.set('toJSON', { virtuals: true });
complaintSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Complaint', complaintSchema);