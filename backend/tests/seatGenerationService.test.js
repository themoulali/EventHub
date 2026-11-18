
jest.mock('../models/Seat', () => ({
  insertMany: jest.fn(),
  find: jest.fn(),
}));

const Seat = require('../models/Seat');

const {
  buildSeatDocuments,
  generateSeatsForEvent,
  generateMissingSeatsForEvent,
} = require('../services/seatGenerationService');

const EVENT_ID = '507f1f77bcf86cd799439011';

const createEvent = (capacity = 100) => ({
  _id: EVENT_ID,
  capacity,
  priceTiers: [
    { name: 'Standard', price: 499, quantity: 60 },
    { name: 'VIP', price: 999, quantity: 40 },
  ],
});

describe('Seat Generation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates exactly the requested number of seats', () => {
    const seats = buildSeatDocuments(createEvent());

    expect(seats).toHaveLength(100);
  });

  test('generates correct seat numbers and rows', () => {
    const seats = buildSeatDocuments(createEvent());

    expect(seats[0].seatNumber).toBe('A1');
    expect(seats[9].seatNumber).toBe('A10');
    expect(seats[10].seatNumber).toBe('B1');
    expect(seats[99].seatNumber).toBe('J10');
  });

  test('initializes all seats as available', () => {
    const seats = buildSeatDocuments(createEvent());

    expect(
      seats.every(
        (seat) =>
          seat.status === 'available' &&
          seat.heldBy === null &&
          seat.holdExpiresAt === null
      )
    ).toBe(true);
  });

  test('assigns Standard pricing to the first 60 seats', () => {
    const seats = buildSeatDocuments(createEvent());

    expect(seats[0]).toMatchObject({
      priceTier: 'Standard',
      price: 499,
    });

    expect(seats[59]).toMatchObject({
      priceTier: 'Standard',
      price: 499,
    });
  });

  test('assigns VIP pricing to the remaining 40 seats', () => {
    const seats = buildSeatDocuments(createEvent());

    expect(seats[60]).toMatchObject({
      priceTier: 'VIP',
      price: 999,
    });

    expect(seats[99]).toMatchObject({
      priceTier: 'VIP',
      price: 999,
    });
  });

  test('rejects invalid event capacity', () => {
    expect(() =>
      buildSeatDocuments({
        ...createEvent(),
        capacity: 0,
      })
    ).toThrow('Event capacity must be a positive integer');

    expect(() =>
      buildSeatDocuments({
        ...createEvent(),
        capacity: 2.5,
      })
    ).toThrow('Event capacity must be a positive integer');
  });

  test('rejects pricing quantities that do not match capacity', () => {
    const event = createEvent();

    event.priceTiers[0].quantity = 50;

    expect(() => buildSeatDocuments(event)).toThrow(
      'Total pricing tier quantities must equal event capacity'
    );
  });

  test('supports row labels beyond Z', () => {
    const event = {
      _id: EVENT_ID,
      capacity: 261,
      priceTiers: [
        { name: 'Standard', price: 499, quantity: 261 },
      ],
    };

    const seats = buildSeatDocuments(event);

    expect(seats[259].seatNumber).toBe('Z10');
    expect(seats[260].seatNumber).toBe('AA1');
  });

  test('saves generated seats using insertMany', async () => {
    Seat.insertMany.mockResolvedValue([]);

    await generateSeatsForEvent(createEvent());

    expect(Seat.insertMany).toHaveBeenCalledTimes(1);

    const [seats, options] = Seat.insertMany.mock.calls[0];

    expect(seats).toHaveLength(100);
    expect(options).toEqual({ ordered: true });
  });

  test('generates only missing seats', async () => {
    Seat.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { seatNumber: 'A1' },
          { seatNumber: 'A2' },
        ]),
      }),
    });

    Seat.insertMany.mockResolvedValue([]);

    await generateMissingSeatsForEvent(createEvent());

    const [missingSeats] = Seat.insertMany.mock.calls[0];

    expect(missingSeats).toHaveLength(98);
    expect(missingSeats[0].seatNumber).toBe('A3');
  });
});
