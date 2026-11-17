
const express = require('express');

const {
  getEventSeats,
  holdSeat,
  releaseSeat,
} = require('../controllers/seatController');

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router({ mergeParams: true });

// Public: Get seats for an event
router.get('/', getEventSeats);

// Attendee only: Hold a seat for two minutes
router.post(
  '/:seatId/hold',
  authMiddleware,
  roleMiddleware('attendee'),
  holdSeat
);

// Attendee only: Release your own seat hold
router.delete(
  '/:seatId/hold',
  authMiddleware,
  roleMiddleware('attendee'),
  releaseSeat
);

module.exports = router;
