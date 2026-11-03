const express = require('express');

const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Public: Get all events with optional search and category filters
router.get('/', getEvents);

// Public: Get one event
router.get('/:id', getEventById);

// Organizer only: Create event
router.post(
  '/',
  authMiddleware,
  roleMiddleware('organizer'),
  createEvent
);

// Organizer only: Update event (ownership checked in controller)
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('organizer'),
  updateEvent
);

// Organizer only: Delete event (ownership checked in controller)
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('organizer'),
  deleteEvent
);

module.exports = router;