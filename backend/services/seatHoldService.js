
const Seat = require('../models/Seat');
const { getIO } = require('../config/socket');

const CLEANUP_INTERVAL_MS = 10 * 1000;

// Broadcast an expired seat becoming available
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

// Release expired holds and notify the relevant event rooms
const releaseExpiredSeats = async (eventId = null) => {
  try {
    const now = new Date();

    const query = {
      status: 'held',
      holdExpiresAt: { $lte: now },
    };

    if (eventId) {
      query.event = eventId;
    }

    const expiredSeats = await Seat.find(query).select('_id');

    let releasedCount = 0;

    for (const expiredSeat of expiredSeats) {
      // Atomic update prevents releasing a seat that was renewed meanwhile
      const releasedSeat = await Seat.findOneAndUpdate(
        {
          _id: expiredSeat._id,
          status: 'held',
          holdExpiresAt: { $lte: now },
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
        }
      );

      if (releasedSeat) {
        releasedCount += 1;
        emitSeatUpdate(releasedSeat);
      }
    }

    if (releasedCount > 0) {
      console.log(
        `Seat cleanup: ${releasedCount} expired hold(s) released`
      );
    }

    return releasedCount;
  } catch (error) {
    console.error('Seat hold cleanup error:', error.message);
    return 0;
  }
};

// Start the background cleanup process
const startSeatHoldCleanup = () => {
  console.log('Seat hold cleanup service started');

  releaseExpiredSeats();

  const intervalId = setInterval(() => {
    releaseExpiredSeats();
  }, CLEANUP_INTERVAL_MS);

  if (typeof intervalId.unref === 'function') {
    intervalId.unref();
  }

  return intervalId;
};

module.exports = {
  releaseExpiredSeats,
  startSeatHoldCleanup,
};
