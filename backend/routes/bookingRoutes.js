
const express = require('express');

const {
  createBooking,
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

module.exports = router;
