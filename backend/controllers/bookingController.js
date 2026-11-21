
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const Seat = require('../models/Seat');
const Event = require('../models/Event');

const {
  processMockPayment,
} = require('../services/paymentService');

const {
  generateTicketNumber,
  generateQrToken,
  generateQrCode,
} = require('../services/ticketService');

const { getIO } = require('../config/socket');

// Broadcast a seat update to attendees viewing this event.
const emitSeatUpdate = (seat) => {
  const io = getIO();

  if (!io) return;

  io.to(`event:${seat.event}`).emit('seatUpdated', {
    eventId: seat.event.toString(),
    seat: {
      id: seat._id,
      seatNumber: seat.seatNumber,
      row: seat.row,
      status: seat.status,
      holdExpiresAt: seat.holdExpiresAt,
    },
  });
};

// Release only the selected seats still held by this attendee.
const releaseAttendeeSeats = async (eventId, attendeeId, seatIds) => {
  for (const seatId of seatIds) {
    const seat = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        event: eventId,
        status: 'held',
        heldBy: attendeeId,
      },
      {
        $set: {
          status: 'available',
          heldBy: null,
          holdExpiresAt: null,
        },
      },
      { new: true }
    );

    if (seat) emitSeatUpdate(seat);
  }
};

// Create a booking for an attendee's held seats.
const createBooking = async (req, res) => {
  let booking;
  let successfulTransactionId = null;

  try {
    const { eventId, seatIds } = req.body;
    const attendeeId = req.user.id;

    // Validate event ID.
    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    // Validate selected seats.
    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one seat',
      });
    }

    if (
      seatIds.some((id) => !mongoose.isValidObjectId(id))
    ) {
      return res.status(400).json({
        success: false,
        message: 'One or more seat IDs are invalid',
      });
    }

    const normalizedSeatIds = seatIds.map((id) => id.toString());
    const uniqueSeatIds = [...new Set(normalizedSeatIds)];

    if (uniqueSeatIds.length !== normalizedSeatIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate seat IDs are not allowed',
      });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const now = new Date();

    // Verify ownership, event, status, and hold expiry.
    const heldSeats = await Seat.find({
      _id: { $in: uniqueSeatIds },
      event: eventId,
      status: 'held',
      heldBy: attendeeId,
      holdExpiresAt: { $gt: now },
    });

    if (heldSeats.length !== uniqueSeatIds.length) {
      return res.status(409).json({
        success: false,
        message: 'One or more seats are unavailable or their holds have expired',
      });
    }

    // Preserve the order in which the attendee selected seats.
    const seatMap = new Map(
      heldSeats.map((seat) => [seat._id.toString(), seat])
    );

    const orderedSeats = uniqueSeatIds.map(
      (id) => seatMap.get(id)
    );

    // Prices are calculated from the database, never from the client.
    for (const seat of orderedSeats) {
      if (
        !Number.isFinite(seat.price) ||
        seat.price < 0 ||
        !seat.priceTier
      ) {
        return res.status(400).json({
          success: false,
          message: 'A selected seat has invalid pricing information',
        });
      }
    }

    const totalAmount = Number(
      orderedSeats.reduce((sum, seat) => sum + seat.price, 0).toFixed(2)
    );

    // Create a pending booking before processing payment.
    booking = await Booking.create({
      bookingReference: `EVT-${randomUUID().toUpperCase()}`,
      attendee: attendeeId,
      event: eventId,
      seats: orderedSeats.map((seat) => ({
        seat: seat._id,
        seatNumber: seat.seatNumber,
        priceTier: seat.priceTier,
        price: seat.price,
      })),
      totalAmount,
      payment: {
        method: 'mock',
        status: 'pending',
      },
      status: 'pending',
    });

    // Simulate payment. Never accept forceFailure from the request body.
    let paymentResult;

    try {
      paymentResult = await processMockPayment({
        amount: totalAmount,
      });
    } catch (paymentError) {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: {
          status: 'failed',
          'payment.status': 'failed',
        },
      });

      await releaseAttendeeSeats(
        eventId,
        attendeeId,
        uniqueSeatIds
      );

      return res.status(502).json({
        success: false,
        message: 'Payment processing failed',
      });
    }

    if (!paymentResult.success) {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: {
          status: 'failed',
          'payment.status': 'failed',
          'payment.transactionId': paymentResult.transactionId || null,
        },
      });

      await releaseAttendeeSeats(
        eventId,
        attendeeId,
        uniqueSeatIds
      );

      return res.status(402).json({
        success: false,
        message: 'Payment unsuccessful. Your booking was not confirmed.',
        bookingReference: booking.bookingReference,
      });
    }

    // Only successful payments reach this assignment.
    successfulTransactionId = paymentResult.transactionId;


    // PASTE THE NEW CODE HERE
    await Booking.findByIdAndUpdate(booking._id, {
      $set: {
        'payment.transactionId': paymentResult.transactionId,
        'payment.status': 'successful',
        'payment.paidAt': paymentResult.paidAt,
      },
    });

    // Prepare ticket and QR data before entering the transaction.
    const ticketDocuments = [];
    const ticketResponses = [];

    for (const seat of orderedSeats) {
      const ticketNumber = generateTicketNumber();

      const qrToken = generateQrToken({
        ticketNumber,
        eventId,
      });

      const qrCode = await generateQrCode(qrToken);

      ticketDocuments.push({
        ticketNumber,
        booking: booking._id,
        attendee: attendeeId,
        event: eventId,
        seat: seat._id,
        seatNumber: seat.seatNumber,
        price: seat.price,
        qrToken,
      });

      ticketResponses.push({
        ticketNumber,
        seatNumber: seat.seatNumber,
        qrCode,
      });
    }

    // Confirm booking, reserve seats, and create tickets atomically.
    const session = await mongoose.startSession();
    const updatedSeats = [];

    try {
      await session.withTransaction(async () => {
        updatedSeats.length = 0;
        const transactionNow = new Date();

        const stillHeldSeats = await Seat.find({
          _id: { $in: uniqueSeatIds },
          event: eventId,
          status: 'held',
          heldBy: attendeeId,
          holdExpiresAt: { $gt: transactionNow },
        }).session(session);

        if (stillHeldSeats.length !== uniqueSeatIds.length) {
          const error = new Error(
            'A seat hold expired or changed before confirmation'
          );
          error.statusCode = 409;
          throw error;
        }

        // Update each seat conditionally to prevent race conditions.
        for (const seatId of uniqueSeatIds) {
          const updatedSeat = await Seat.findOneAndUpdate(
            {
              _id: seatId,
              event: eventId,
              status: 'held',
              heldBy: attendeeId,
              holdExpiresAt: { $gt: transactionNow },
            },
            {
              $set: {
                status: 'booked',
                heldBy: null,
                holdExpiresAt: null,
              },
            },
            {
              new: true,
              session,
            }
          );

          if (!updatedSeat) {
            const error = new Error(
              'A seat could not be reserved'
            );
            error.statusCode = 409;
            throw error;
          }

          updatedSeats.push(updatedSeat);
        }

        const bookingUpdate = await Booking.updateOne(
          {
            _id: booking._id,
            status: 'pending',
          },
          {
            $set: {
              status: 'confirmed',
              confirmedAt: new Date(),
              'payment.method': 'mock',
              'payment.transactionId': paymentResult.transactionId,
              'payment.status': 'successful',
              'payment.paidAt': paymentResult.paidAt,
            },
          },
          { session }
        );

        if (bookingUpdate.matchedCount !== 1) {
          throw new Error('Pending booking could not be confirmed');
        }

        await Ticket.insertMany(ticketDocuments, { session });
      });
    } finally {
      await session.endSession();
    }

    // Broadcast only after the transaction commits.
    updatedSeats.forEach(emitSeatUpdate);

    return res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: {
        id: booking._id,
        bookingReference: booking.bookingReference,
        event: event.name,
        seats: booking.seats,
        totalAmount,
        status: 'confirmed',
        payment: {
          status: 'successful',
          transactionId: paymentResult.transactionId,
          paidAt: paymentResult.paidAt,
        },
      },
      tickets: ticketResponses,
    });
  } catch (error) {
    console.error('Booking creation error:', error.message);

    // Payment succeeded but database confirmation failed.
    // Since this is a mock payment, record a simulated refund.
    
    if (booking) {
      try {
        await Booking.findByIdAndUpdate(booking._id, {
          $set: {
            status: 'failed',
            'payment.status': successfulTransactionId
              ? 'refunded'
              : 'failed',
            'payment.transactionId': successfulTransactionId,
          },
        });

        await releaseAttendeeSeats(
          booking.event,
          req.user.id,
          booking.seats.map((seat) => seat.seat)
        );
      } catch (recoveryError) {
        console.error(
          'Booking recovery error:',
          recoveryError.message
        );
      }
    }
    
    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode === 409
          ? error.message
          : 'Unable to complete booking',
    });
  }
};

module.exports = {
  createBooking,
};
