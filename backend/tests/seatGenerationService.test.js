jest.mock('../models/Seat', () => ({
  insertMany: jest.fn(),
}));

const Seat = require('../models/Seat');

const {
  buildSeatDocuments,
  generateSeatsForEvent,
} = require('../services/seatGenerationService');

const EVENT_ID = '507f1f77bcf86cd799439011';

describe('Seat Generation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates exactly the requested number of seats', () => {
    const seats = buildSeatDocuments({
      _id: EVENT_ID,
      capacity: 23,
    });

    expect(seats).toHaveLength(23);
  });

  test('generates correct seat numbers and rows', () => {
    const seats = buildSeatDocuments({
      _id: EVENT_ID,
      capacity: 23,
    });

    expect(seats[0].seatNumber).toBe('A1');
    expect(seats[9].seatNumber).toBe('A10');
    expect(seats[10].seatNumber).toBe('B1');
    expect(seats[22].seatNumber).toBe('C3');
  });

  test('initializes all seats as available', () => {
    const seats = buildSeatDocuments({
      _id: EVENT_ID,
      capacity: 10,
    });

    expect(
      seats.every(
        (seat) =>
          seat.status === 'available' &&
          seat.heldBy === null &&
          seat.holdExpiresAt === null
      )
    ).toBe(true);
  });

  test('rejects invalid event capacity', () => {
    expect(() =>
      buildSeatDocuments({
        _id: EVENT_ID,
        capacity: 0,
      })
    ).toThrow('Event capacity must be a positive integer');

    expect(() =>
      buildSeatDocuments({
        _id: EVENT_ID,
        capacity: 2.5,
      })
    ).toThrow('Event capacity must be a positive integer');
  });

  test('supports row labels beyond Z', () => {
    const seats = buildSeatDocuments({
      _id: EVENT_ID,
      capacity: 261,
    });

    expect(seats[259].seatNumber).toBe('Z10');
    expect(seats[260].seatNumber).toBe('AA1');
  });

  test('saves generated seats using insertMany', async () => {
    Seat.insertMany.mockResolvedValue([]);

    await generateSeatsForEvent({
      _id: EVENT_ID,
      capacity: 20,
    });

    expect(Seat.insertMany).toHaveBeenCalledTimes(1);

    const [seats, options] = Seat.insertMany.mock.calls[0];

    expect(seats).toHaveLength(20);
    expect(options).toEqual({ ordered: true });
  });
});