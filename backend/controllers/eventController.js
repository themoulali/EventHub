const mongoose = require('mongoose');
const Event = require('../models/Event');

// Allowed event fields
const allowedFields = [
  'name',
  'description',
  'date',
  'venue',
  'capacity',
  'priceTiers',
  'category',
];

// Validate event input
const validateEventInput = (data, isUpdate = false) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Invalid event data';
  }

  if (!isUpdate) {
    const requiredFields = [
      'name',
      'date',
      'venue',
      'capacity',
      'priceTiers',
      'category',
    ];

    const missingFields = requiredFields.filter(
      (field) =>
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ''
    );

    if (missingFields.length > 0) {
      return `Missing required fields: ${missingFields.join(', ')}`;
    }
  }

  const invalidFields = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (invalidFields.length > 0) {
    return `Invalid fields: ${invalidFields.join(', ')}`;
  }

  return null;
};

// CREATE EVENT
const createEvent = async (req, res) => {
  try {
    const validationError = validateEventInput(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const event = await Event.create({
      ...req.body,
      organizer: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Create event error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to create event',
    });
  }
};

// GET ALL EVENTS
const getEvents = async (req, res) => {
  try {
    const { search, category } = req.query;

    const filter = {};

    if (search && search.trim()) {
      filter.name = {
        $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    }

    if (category && category.trim()) {
      filter.category = {
        $regex: `^${category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        $options: 'i',
      };
    }

    const events = await Event.find(filter)
      .populate('organizer', 'name email')
      .sort({ date: 1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error('Get events error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve events',
    });
  }
};

// GET SINGLE EVENT
const getEventById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    return res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('Get event error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve event',
    });
  }
};

// UPDATE EVENT
const updateEvent = async (req, res) => {
  try {
    const validationError = validateEventInput(req.body, true);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this event',
      });
    }

    Object.assign(event, req.body);

    await event.save();

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      event,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Update event error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to update event',
    });
  }
};

// DELETE EVENT
const deleteEvent = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this event',
      });
    }

    await event.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('Delete event error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to delete event',
    });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
};