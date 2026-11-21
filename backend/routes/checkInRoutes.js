const express = require('express');

const { checkIn } = require('../controllers/checkInController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Only authenticated organizers can check in attendees.
router.post(
  '/:eventId',
  authMiddleware,
  roleMiddleware('organizer'),
  checkIn
);

module.exports = router;