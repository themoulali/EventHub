const mongoose = require('mongoose');
const Event = require('../models/Event');
const Seat = require('../models/Seat');

const {
  generateSeatsForEvent,
  generateMissingSeatsForEvent,
} = require('../services/seatGenerationService');

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


const validatePricingUpdateWithExistingSeats = (
  currentTiers,
  updatedTiers,
  nextCapacity
) => {
  if (!Array.isArray(updatedTiers) || updatedTiers.length === 0) {
    return 'At least one pricing tier is required';
  }

  if (updatedTiers.length !== currentTiers.length) {
    return 'Pricing tiers cannot be added or removed after seats have been generated';
  }

  for (let index = 0; index < currentTiers.length; index += 1) {
    const current = currentTiers[index];
    const updated = updatedTiers[index];

    if (
      !updated ||
      typeof updated !== 'object' ||
      Array.isArray(updated)
    ) {
      return 'Each pricing tier must be a valid object';
    }

    if (
      current.name !== updated.name ||
      Number(current.price) !== Number(updated.price)
    ) {
      return 'Existing pricing tier names and prices cannot be changed after seats have been generated';
    }

    if (index < currentTiers.length - 1) {
      if (Number(updated.quantity) !== Number(current.quantity)) {
        return 'Only the final pricing tier quantity can be increased';
      }
    } else if (Number(updated.quantity) < Number(current.quantity)) {
      return 'The final pricing tier quantity cannot be decreased';
    }
  }

  const totalQuantity = updatedTiers.reduce(
    (total, tier) => total + Number(tier.quantity),
    0
  );

  if (totalQuantity !== Number(nextCapacity)) {
    return 'Total pricing tier quantities must equal event capacity';
  }

  return null;
};
const validatePricingTiers = (tiers, capacity) => {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return 'At least one pricing tier is required';
  }

  if (!Number.isInteger(capacity) || capacity < 1) {
    return 'Event capacity must be a positive whole number';
  }

  let totalQuantity = 0;

  for (const tier of tiers) {
    if (!tier || typeof tier !== 'object' || Array.isArray(tier)) {
      return 'Each pricing tier must be a valid object';
    }

    if (typeof tier.name !== 'string' || !tier.name.trim()) {
      return 'Each pricing tier must have a name';
    }

    if (
      tier.price === undefined ||
      tier.price === null ||
      tier.price === '' ||
      !Number.isFinite(Number(tier.price)) ||
      Number(tier.price) < 0
    ) {
      return 'Each pricing tier must have a valid non-negative price';
    }

    if (
      tier.quantity === undefined ||
      tier.quantity === null ||
      tier.quantity === '' ||
      !Number.isInteger(Number(tier.quantity)) ||
      Number(tier.quantity) < 1
    ) {
      return 'Each pricing tier quantity must be a positive whole number';
    }

    totalQuantity += Number(tier.quantity);
  }

  if (totalQuantity !== capacity) {
    return 'Total pricing tier quantities must equal event capacity';
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

    try {
      await generateSeatsForEvent(event);
    } catch (seatError) {
      // Remove the event if seat generation fails.
      try {
        await event.deleteOne();
      } catch (cleanupError) {
        console.error('Failed to clean up event after seat generation:', cleanupError);
      }

      throw seatError;
    }

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
  let session;

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

    // Start a MongoDB transaction.
    session = await mongoose.startSession();
    session.startTransaction();

    // Read the event inside the transaction.
    const event = await Event.findById(req.params.id).session(session);

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

    // Check existing seats inside the same transaction.
    const existingSeats = await Seat.find({
      event: event._id,
    })
      .session(session)
      .select('_id')
      .lean();

    const hasExistingSeats = existingSeats.length > 0;

    const nextCapacity =
      req.body.capacity !== undefined
        ? Number(req.body.capacity)
        : event.capacity;

    const nextPriceTiers =
      req.body.priceTiers !== undefined
        ? req.body.priceTiers
        : event.priceTiers;

    // Protect existing seats and pricing information.
    if (hasExistingSeats) {
      if (nextCapacity < event.capacity) {
        return res.status(400).json({
          success: false,
          message:
            'Event capacity cannot be reduced after seats have been generated',
        });
      }

      const pricingError = validatePricingUpdateWithExistingSeats(
        event.priceTiers,
        nextPriceTiers,
        nextCapacity
      );

      if (pricingError) {
        return res.status(400).json({
          success: false,
          message: pricingError,
        });
      }
    }

    // Validate pricing and capacity before saving.
    const generalPricingError = validatePricingTiers(
      nextPriceTiers,
      nextCapacity
    );

    if (generalPricingError) {
      return res.status(400).json({
        success: false,
        message: generalPricingError,
      });
    }

    // Update the event inside the transaction.
    Object.assign(event, req.body);

    await event.save({ session });

    // Generate missing seats inside the same transaction.
    if (req.body.capacity !== undefined && hasExistingSeats) {
      await generateMissingSeatsForEvent(event, session);
    }

    // Generate all seats if none existed previously.
    if (!hasExistingSeats && req.body.capacity !== undefined) {
      await generateSeatsForEvent(event, session);
    }

    // Commit only after both operations succeed.
    await session.commitTransaction();

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
  } finally {
    if (session) {
      // Abort any transaction that did not commit.
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error('Transaction rollback error:', abortError.message);
        }
      }

      await session.endSession();
    }
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