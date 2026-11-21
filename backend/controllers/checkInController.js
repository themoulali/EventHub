const mongoose = require('mongoose');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { verifyQrToken } = require('../services/ticketService');
const { getIO } = require('../config/socket');
const checkIn = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { token } = req.body;
    // 1. Validate the event ID.
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }
    // 2. Find the event.
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }
    // 3. Confirm event ownership.
    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to check in attendees for this event',
      });
    }
    // 4. Validate the scanned QR token.
    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'QR token is required',
      });
    }
    let decodedToken;
    try {
      decodedToken = verifyQrToken(token);
    } catch (error) {
      if (error.message === 'QR_TOKEN_SECRET is not configured') {
        throw error;
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired ticket QR code',
      });
    }
    // 5. Ensure the QR code belongs to this event.
    if (decodedToken.eventId.toLowerCase() !== eventId.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'This ticket does not belong to this event',
      });
    }
    // 6. Find the ticket and include its normally hidden QR token.
    const ticket = await Ticket.findOne({
      ticketNumber: decodedToken.ticketNumber,
      event: eventId,
    }).select('+qrToken');
    if (!ticket || ticket.qrToken !== token) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found or QR code is invalid',
      });
    }
    if (ticket.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This ticket has been cancelled',
      });
    }
    if (ticket.status === 'used' || ticket.checkedInAt) {
      return res.status(409).json({
        success: false,
        message: 'This ticket has already been checked in',
      });
    }
    if (ticket.status !== 'valid') {
      return res.status(400).json({
        success: false,
        message: 'This ticket is not valid for check-in',
      });
    }
    // 7. Atomically update the ticket to prevent duplicate check-ins.
    const checkedInAt = new Date();
    const updateResult = await Ticket.updateOne(
      {
        _id: ticket._id,
        status: 'valid',
        checkedInAt: null,
      },
      {
        $set: {
          status: 'used',
          checkedInAt,
        },
      }
    );
    if (updateResult.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: 'This ticket has already been checked in',
      });
    }
    // 8. Count checked-in attendees.
    const checkedInCount = await Ticket.countDocuments({
      event: eventId,
      status: 'used',
    });
    // 9. Broadcast the updated attendance to this event's room.
    const io = getIO();
    if (io) {
      io.to(`event:${eventId}`).emit('attendanceUpdated', {
        eventId,
        checkedInCount,
        capacity: event.capacity,
      });
    }
    // 10. Return the check-in confirmation.
    return res.status(200).json({
      success: true,
      message: 'Attendee checked in successfully',
      data: {
        ticketNumber: ticket.ticketNumber,
        seatNumber: ticket.seatNumber,
        eventName: event.name,
        checkedInAt,
        checkedInCount,
        capacity: event.capacity,
      },
    });
  } catch (error) {
    console.error('Check-in error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to complete attendee check-in',
    });
  }
};
module.exports = { checkIn };
