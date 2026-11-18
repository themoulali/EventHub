
const Seat = require('../models/Seat');

const SEATS_PER_ROW = 10;

const getRowLabel = (index) => {
  let label = '';
  let number = index + 1;

  while (number > 0) {
    number -= 1;
    label = String.fromCharCode(65 + (number % 26)) + label;
    number = Math.floor(number / 26);
  }

  return label;
};

// Validate event pricing and ensure quantities match capacity.
const validateSeatPricing = (event) => {
  if (!Array.isArray(event.priceTiers) || event.priceTiers.length === 0) {
    throw new Error('At least one pricing tier is required');
  }

  let totalQuantity = 0;

  for (const tier of event.priceTiers) {
    if (
      !tier.name ||
      typeof tier.name !== 'string' ||
      !tier.name.trim()
    ) {
      throw new Error('Every pricing tier must have a valid name');
    }

    if (
      typeof tier.price !== 'number' ||
      !Number.isFinite(tier.price) ||
      tier.price < 0
    ) {
      throw new Error('Every pricing tier must have a valid price');
    }

    if (!Number.isInteger(tier.quantity) || tier.quantity < 1) {
      throw new Error('Every pricing tier must have a valid quantity');
    }

    totalQuantity += tier.quantity;
  }

  if (totalQuantity !== event.capacity) {
    throw new Error(
      'Total pricing tier quantities must equal event capacity'
    );
  }
};

// Find the pricing tier assigned to a seat position.
const getPriceTierForSeat = (event, seatIndex) => {
  let currentPosition = 0;

  for (const tier of event.priceTiers) {
    currentPosition += tier.quantity;

    if (seatIndex < currentPosition) {
      return tier;
    }
  }

  throw new Error('Unable to assign pricing tier to seat');
};

const buildSeatDocuments = (event) => {
  if (!event || !event._id) {
    throw new Error('A valid event is required to generate seats');
  }

  if (!Number.isInteger(event.capacity) || event.capacity <= 0) {
    throw new Error('Event capacity must be a positive integer');
  }

  validateSeatPricing(event);

  const seats = [];

  for (let index = 0; index < event.capacity; index += 1) {
    const rowIndex = Math.floor(index / SEATS_PER_ROW);
    const seatPosition = (index % SEATS_PER_ROW) + 1;
    const row = getRowLabel(rowIndex);

    const priceTier = getPriceTierForSeat(event, index);

    seats.push({
      event: event._id,
      seatNumber: `${row}${seatPosition}`,
      row,
      status: 'available',
      heldBy: null,
      holdExpiresAt: null,
      priceTier: priceTier.name,
      price: priceTier.price,
    });
  }

  return seats;
};


const generateSeatsForEvent = async (event, session = null) => {
  const seatDocuments = buildSeatDocuments(event);

  const options = { ordered: true };

  if (session) {
    options.session = session;
  }

  return Seat.insertMany(seatDocuments, options);
};

// Generate only missing seats while preserving existing seat records.
const generateMissingSeatsForEvent = async (event, session = null) => {
  let existingSeatsQuery = Seat.find({
    event: event._id,
  })
    .select('seatNumber');

  if (session) {
    existingSeatsQuery = existingSeatsQuery.session(session);
  }

  const existingSeats = await existingSeatsQuery.lean();

  const existingSeatNumbers = new Set(
    existingSeats.map((seat) => seat.seatNumber)
  );

  const expectedSeats = buildSeatDocuments(event);

  const missingSeats = expectedSeats.filter(
    (seat) => !existingSeatNumbers.has(seat.seatNumber)
  );

  if (missingSeats.length === 0) {
    return [];
  }

  const options = { ordered: true };

  if (session) {
    options.session = session;
  }

  return Seat.insertMany(missingSeats, options);
};

module.exports = {
  buildSeatDocuments,
  generateSeatsForEvent,
  generateMissingSeatsForEvent,
};
