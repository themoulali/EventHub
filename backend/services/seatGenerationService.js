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

const buildSeatDocuments = (event) => {
  if (!event || !event._id) {
    throw new Error('A valid event is required to generate seats');
  }

  if (!Number.isInteger(event.capacity) || event.capacity <= 0) {
    throw new Error('Event capacity must be a positive integer');
  }

  const seats = [];

  for (let index = 0; index < event.capacity; index += 1) {
    const rowIndex = Math.floor(index / SEATS_PER_ROW);
    const seatPosition = (index % SEATS_PER_ROW) + 1;
    const row = getRowLabel(rowIndex);

    seats.push({
      event: event._id,
      seatNumber: `${row}${seatPosition}`,
      row,
      status: 'available',
      heldBy: null,
      holdExpiresAt: null,
    });
  }

  return seats;
};

const generateSeatsForEvent = async (event) => {
  const seatDocuments = buildSeatDocuments(event);

  return Seat.insertMany(seatDocuments, { ordered: true });
};

// Generate only seats that do not already exist.
const generateMissingSeatsForEvent = async (event) => {
  const existingSeats = await Seat.find({
    event: event._id,
  })
    .select('seatNumber')
    .lean();

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

  return Seat.insertMany(missingSeats, { ordered: true });
};

module.exports = {
  buildSeatDocuments,
  generateSeatsForEvent,
  generateMissingSeatsForEvent,
};