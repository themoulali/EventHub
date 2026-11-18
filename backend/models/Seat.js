
const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    // Event to which this seat belongs
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
    },

    // Seat identifier, for example A1, A2, B1
    seatNumber: {
      type: String,
      required: [true, 'Seat number is required'],
      trim: true,
      uppercase: true,
    },

    // Seating row, for example A, B, C
    row: {
      type: String,
      required: [true, 'Seat row is required'],
      trim: true,
      uppercase: true,
    },

    // Current seat availability
    status: {
      type: String,
      enum: {
        values: ['available', 'held', 'booked'],
        message: 'Invalid seat status',
      },
      default: 'available',
      required: true,
    },

    // Attendee who currently holds this seat
    heldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Time when the temporary hold expires
    holdExpiresAt: {
      type: Date,
      default: null,
    },
    // Ticket pricing tier assigned to this seat
priceTier: {
  type: String,
  trim: true,
  default: null,
},

// Price of this seat, stored as a snapshot
price: {
  type: Number,
  min: [0, 'Seat price cannot be negative'],
  default: null,
},
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate seat numbers within the same event
seatSchema.index(
  { event: 1, seatNumber: 1 },
  { unique: true }
);

// Improve event seat availability queries
seatSchema.index({ event: 1, status: 1 });

// Support expired seat lookup
seatSchema.index({ status: 1, holdExpiresAt: 1 });

module.exports =
  mongoose.models.Seat || mongoose.model('Seat', seatSchema);
