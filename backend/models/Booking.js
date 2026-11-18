
const mongoose = require('mongoose');

// Individual seat and price information saved at booking time
const bookedSeatSchema = new mongoose.Schema(
  {
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

    priceTier: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

// Payment information
const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['mock'],
      default: 'mock',
    },

    transactionId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'successful', 'failed', 'refunded'],
      default: 'pending',
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

// Main booking schema
const bookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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

    seats: {
      type: [bookedSeatSchema],
      required: true,
      validate: {
        validator: function (seats) {
          return seats.length > 0;
        },
        message: 'At least one seat must be booked',
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    payment: {
      type: paymentSchema,
      default: () => ({}),
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed', 'cancelled'],
      default: 'pending',
    },

    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Useful indexes for attendee booking history
bookingSchema.index({ attendee: 1, createdAt: -1 });
bookingSchema.index({ event: 1, status: 1 });

module.exports =
  mongoose.models.Booking ||
  mongoose.model('Booking', bookingSchema);
