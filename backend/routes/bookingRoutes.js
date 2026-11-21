const express = require('express');

const {
  createBooking,
  getMyBookings,
  cancelBooking,
} = require('../controllers/bookingController');

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Only authenticated attendees can create bookings.
router.post(
  '/',
  authMiddleware,
  roleMiddleware('attendee'),
  createBooking
);

// Only authenticated attendees can view their own bookings.
router.get(
  '/my-bookings',
  authMiddleware,
  roleMiddleware('attendee'),
  getMyBookings
);

// Only authenticated attendees can cancel their own bookings.
router.post(
  '/:bookingId/cancel',
  authMiddleware,
  roleMiddleware('attendee'),
  cancelBooking
);

module.exports = router;