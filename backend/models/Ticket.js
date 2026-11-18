
const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },

    attendee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },

    seat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seat',
      required: true,
    },

    seatNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    qrToken: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    status: {
      type: String,
      enum: ['valid', 'used', 'cancelled'],
      default: 'valid',
    },

    checkedInAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent multiple tickets for the same seat in one event.
ticketSchema.index(
  { event: 1, seat: 1 },
  { unique: true }
);

// Find tickets belonging to an attendee.
ticketSchema.index({ attendee: 1, createdAt: -1 });

module.exports =
  mongoose.models.Ticket ||
  mongoose.model('Ticket', ticketSchema);
