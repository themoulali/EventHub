const mongoose = require('mongoose');

// Ticket pricing subdocument
const priceTierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ticket tier name is required'],
      trim: true,
    },

    price: {
      type: Number,
      required: [true, 'Ticket price is required'],
      min: [0, 'Ticket price cannot be negative'],
    },

    quantity: {
      type: Number,
      required: [true, 'Ticket quantity is required'],
      min: [1, 'Ticket quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Ticket quantity must be a whole number',
      },
    },
  },
  {
    _id: false,
  }
);

// Main Event schema
const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      minlength: [3, 'Event name must be at least 3 characters'],
      maxlength: [120, 'Event name cannot exceed 120 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },

    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },

    venue: {
      type: String,
      required: [true, 'Event venue is required'],
      trim: true,
      maxlength: [200, 'Venue cannot exceed 200 characters'],
    },

    capacity: {
      type: Number,
      required: [true, 'Event capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Capacity must be a whole number',
      },
    },

    priceTiers: {
      type: [priceTierSchema],
      required: true,
      validate: {
        validator: function (tiers) {
          return tiers.length > 0;
        },
        message: 'At least one ticket pricing tier is required',
      },
    },

    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Event organizer is required'],
    },

    category: {
      type: String,
      required: [true, 'Event category is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for event discovery
eventSchema.index({ name: 'text' });
eventSchema.index({ category: 1 });
eventSchema.index({ organizer: 1 });

module.exports =
  mongoose.models.Event || mongoose.model('Event', eventSchema);