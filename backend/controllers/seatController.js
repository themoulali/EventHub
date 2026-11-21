
const mongoose = require('mongoose');
const Seat = require('../models/Seat');
const Event = require('../models/Event');
const { getIO } = require('../config/socket');
const { releaseExpiredSeats } = require('../services/seatHoldService');

const HOLD_DURATION_MS = 2 * 60 * 1000;

// Notify attendees viewing the same event
const emitSeatUpdate = (eventId, seat) => {
  const io = getIO();

  if (!io) return;

  io.to(`event:${eventId}`).emit('seatUpdated', {
    eventId: eventId.toString(),
    seat: {
      id: seat._id,
      seatNumber: seat.seatNumber,
      row: seat.row,
      status: seat.status,
      holdExpiresAt: seat.holdExpiresAt,
    },
  });
};

// Get all seats belonging to an event
const getEventSeats = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    const eventExists = await Event.exists({ _id: eventId });

    if (!eventExists) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Release expired holds and broadcast their availability
    await releaseExpiredSeats(eventId);

    const seats = await Seat.find({ event: eventId })
      .select('seatNumber row status heldBy holdExpiresAt priceTier price')
      .sort({ row: 1, seatNumber: 1 });

    return res.status(200).json({
      success: true,
      count: seats.length,
      seats,
    });
  } catch (error) {
    console.error('Get event seats error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve seats',
    });
  }
};

// Hold a seat for two minutes
const holdSeat = async (req, res) => {
  try {
    const { eventId, seatId } = req.params;
    const userId = req.user.id;

    if (
      !mongoose.isValidObjectId(eventId) ||
      !mongoose.isValidObjectId(seatId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID or seat ID',
      });
    }

    const eventExists = await Event.exists({ _id: eventId });

    if (!eventExists) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const now = new Date();
    const holdExpiresAt = new Date(now.getTime() + HOLD_DURATION_MS);

    // Only one concurrent request can successfully update this seat.
    // An expired hold can also be claimed by another attendee.
    const seat = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        event: eventId,
        $or: [
          { status: 'available' },
          {
            status: 'held',
            holdExpiresAt: { $lte: now },
          },
        ],
      },
      {
        $set: {
          status: 'held',
          heldBy: userId,
          holdExpiresAt,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!seat) {
      return res.status(409).json({
        success: false,
        message: 'Seat is unavailable or already held',
      });
    }

    emitSeatUpdate(eventId, seat);

    return res.status(200).json({
      success: true,
      message: 'Seat held successfully for two minutes',
      seat,
    });
  } catch (error) {
    console.error('Hold seat error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to hold seat',
    });
  }
};

// Release a seat held by the logged-in attendee
const releaseSeat = async (req, res) => {
  try {
    const { eventId, seatId } = req.params;
    const userId = req.user.id;

    if (
      !mongoose.isValidObjectId(eventId) ||
      !mongoose.isValidObjectId(seatId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID or seat ID',
      });
    }

    const seat = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        event: eventId,
        status: 'held',
        heldBy: userId,
      },
      {
        $set: {
          status: 'available',
          heldBy: null,
          holdExpiresAt: null,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Your active seat hold was not found',
      });
    }

    emitSeatUpdate(eventId, seat);

    return res.status(200).json({
      success: true,
      message: 'Seat released successfully',
      seat,
    });
  } catch (error) {
    console.error('Release seat error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to release seat',
    });
  }
};

module.exports = {
  getEventSeats,
  holdSeat,
  releaseSeat,
};
