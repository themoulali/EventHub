
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');

const {
  processMockPayment,
} = require('../services/paymentService');

const {
  generateTicketNumber,
  generateQrToken,
  generateQrCode,
} = require('../services/ticketService');

jest.mock('../models/Booking', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../models/Ticket', () => ({
  find: jest.fn(),
  insertMany: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock('../models/Seat', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock('../models/Event', () => ({
  findById: jest.fn(),
}));

jest.mock('../services/paymentService', () => ({
  processMockPayment: jest.fn(),
}));

jest.mock('../services/ticketService', () => ({
  generateTicketNumber: jest.fn(),
  generateQrToken: jest.fn(),
  generateQrCode: jest.fn(),
}));

jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => null),
}));

const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const Event = require('../models/Event');

const app = require('../server');

const EVENT_ID = '507f1f77bcf86cd799439011';
const ATTENDEE_ID = '507f191e810c19729de860ec';
const ORGANIZER_ID = '507f191e810c19729de860ea';
const INVALID_ID = 'not-a-valid-id';

const createToken = (userId, role) =>
  jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET
  );

describe('Booking routes', () => {
  let attendeeToken;
  let organizerToken;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.JWT_SECRET = 'test-only-secret-for-bookings';

    attendeeToken = createToken(ATTENDEE_ID, 'attendee');
    organizerToken = createToken(ORGANIZER_ID, 'organizer');

    Booking.create.mockResolvedValue({
      _id: 'booking-test-id',
      bookingReference: 'EVT-TEST-001',
    });

    Booking.findByIdAndUpdate.mockResolvedValue({});
    Booking.updateOne.mockResolvedValue({ matchedCount: 1 });

    Seat.find.mockResolvedValue([]);
    Seat.findOneAndUpdate.mockResolvedValue(null);

    Event.findById.mockResolvedValue(null);
  });

  Booking.findOne.mockReturnValue({
    session: jest.fn().mockReturnThis(),
    populate: jest.fn().mockResolvedValue(null),
  });

  Ticket.updateMany.mockResolvedValue({
    matchedCount: 0,
    modifiedCount: 0,
  });

  Seat.updateMany.mockResolvedValue({
    matchedCount: 0,
    modifiedCount: 0,
  });

  // Default mock behavior for booking history
  Booking.find.mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  });

  Ticket.find.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  });

  test('should reject requests without authentication', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({
        eventId: EVENT_ID,
        seatIds: [],
      });

    expect(response.status).toBe(401);
    expect(Booking.create).not.toHaveBeenCalled();
  });

  test('should reject organizer booking requests', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: [],
      });

    expect(response.status).toBe(403);
    expect(Booking.create).not.toHaveBeenCalled();
  });

  test('should reject an invalid event ID', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: INVALID_ID,
        seatIds: [ATTENDEE_ID],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid event ID');
    expect(Event.findById).not.toHaveBeenCalled();
  });

  test('should reject an empty seat selection', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Select at least one seat');
    expect(Event.findById).not.toHaveBeenCalled();
  });

  test('should reject invalid seat IDs', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: [INVALID_ID],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'One or more seat IDs are invalid'
    );
    expect(Event.findById).not.toHaveBeenCalled();
  });

  test('should reject duplicate seat IDs', async () => {
    const seatId = '507f1f77bcf86cd799439012';

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: [seatId, seatId],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Duplicate seat IDs are not allowed'
    );
    expect(Event.findById).not.toHaveBeenCalled();
  });

  test('should return 404 when the event does not exist', async () => {
    Event.findById.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: ['507f1f77bcf86cd799439012'],
      });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Event not found');
    expect(Booking.create).not.toHaveBeenCalled();
  });

  test('should reject seats that are not held by the attendee', async () => {
    Event.findById.mockResolvedValue({
      _id: EVENT_ID,
      name: 'EventHub Test Event',
    });

    Seat.find.mockResolvedValue([]);

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: ['507f1f77bcf86cd799439012'],
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'One or more seats are unavailable or their holds have expired'
    );
    expect(Booking.create).not.toHaveBeenCalled();
  });


  test('should successfully create a booking and generate tickets', async () => {
    const seatId = '507f1f77bcf86cd799439012';

    const seat = {
      _id: seatId,
      event: EVENT_ID,
      seatNumber: 'A1',
      row: 'A',
      status: 'held',
      heldBy: ATTENDEE_ID,
      holdExpiresAt: new Date(Date.now() + 120000),
      priceTier: 'Standard',
      price: 499,
    };

    Event.findById.mockResolvedValue({
      _id: EVENT_ID,
      name: 'EventHub Test Event',
    });

    // First call checks the attendee's active holds.
    // Second call rechecks them inside the transaction.
    Seat.find
      .mockImplementationOnce(() => Promise.resolve([seat]))
      .mockImplementationOnce(() => ({
        session: jest.fn().mockResolvedValue([seat]),
      }));

    Seat.findOneAndUpdate.mockResolvedValue({
      ...seat,
      status: 'booked',
      heldBy: null,
    });

    Booking.create.mockResolvedValue({
      _id: 'booking-test-id',
      bookingReference: 'EVT-TEST-001',
      seats: [
        {
          seat: seatId,
          seatNumber: 'A1',
          priceTier: 'Standard',
          price: 499,
        },
      ],
      payment: {},
    });

    processMockPayment.mockResolvedValue({
      success: true,
      transactionId: 'MOCK-TRANSACTION-001',
      paidAt: new Date(),
    });

    generateTicketNumber.mockReturnValue('EVT-TICKET-001');
    generateQrToken.mockReturnValue('test-qr-token');
    generateQrCode.mockResolvedValue(
      'data:image/png;base64,test'
    );

    Ticket.insertMany.mockResolvedValue([]);

    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(mongoose, 'startSession')
      .mockResolvedValue(session);

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: [seatId],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      'Booking confirmed successfully'
    );

    expect(response.body.booking.status).toBe('confirmed');
    expect(response.body.booking.totalAmount).toBe(499);

    expect(response.body.tickets).toHaveLength(1);
    expect(response.body.tickets[0].ticketNumber).toBe(
      'EVT-TICKET-001'
    );

    expect(processMockPayment).toHaveBeenCalledWith({
      amount: 499,
    });

    expect(Booking.create).toHaveBeenCalled();
    expect(Booking.updateOne).toHaveBeenCalled();
    expect(Ticket.insertMany).toHaveBeenCalled();
    expect(session.withTransaction).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  test('should reject booking when mock payment fails', async () => {
    const seatId = '507f1f77bcf86cd799439012';

    const seat = {
      _id: seatId,
      event: EVENT_ID,
      seatNumber: 'A1',
      row: 'A',
      status: 'held',
      heldBy: ATTENDEE_ID,
      holdExpiresAt: new Date(Date.now() + 120000),
      priceTier: 'Standard',
      price: 499,
    };

    Event.findById.mockResolvedValue({
      _id: EVENT_ID,
      name: 'EventHub Test Event',
    });

    Seat.find.mockResolvedValue([seat]);

    processMockPayment.mockResolvedValue({
      success: false,
      transactionId: 'MOCK-FAILED-001',
      paidAt: null,
    });

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: [seatId],
      });

    expect(response.status).toBe(402);
    expect(response.body.success).toBe(false);

    expect(response.body.message).toBe(
      'Payment unsuccessful. Your booking was not confirmed.'
    );

    expect(Booking.create).toHaveBeenCalled();

    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
      'booking-test-id',
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          'payment.status': 'failed',
          'payment.transactionId': 'MOCK-FAILED-001',
        }),
      })
    );

    // A failed payment must not generate tickets.
    expect(Ticket.insertMany).not.toHaveBeenCalled();

    // A failed payment must not start the confirmation transaction.
    expect(mongoose.startSession).not.toHaveBeenCalled();

    // The attendee's held seat should be released.
    expect(Seat.findOneAndUpdate).toHaveBeenCalled();
  });
    test('should refund payment when booking transaction fails', async () => {
        const seatId = '507f1f77bcf86cd799439012';

        const seat = {
            _id: seatId,
            event: EVENT_ID,
            seatNumber: 'A1',
            row: 'A',
            status: 'held',
            heldBy: ATTENDEE_ID,
            holdExpiresAt: new Date(Date.now() + 120000),
            priceTier: 'Standard',
            price: 499,
        };

        Event.findById.mockResolvedValue({
            _id: EVENT_ID,
            name: 'EventHub Test Event',
        });

        Seat.find
            .mockImplementationOnce(() => Promise.resolve([seat]))
            .mockImplementationOnce(() => ({
                session: jest.fn().mockResolvedValue([seat]),
            }));

        Seat.findOneAndUpdate.mockResolvedValue({
            ...seat,
            status: 'booked',
            heldBy: null,
        });

        Booking.create.mockResolvedValue({
            _id: 'booking-test-id',
            bookingReference: 'EVT-TEST-002',
            event: EVENT_ID,
            seats: [
                {
                    seat: seatId,
                    seatNumber: 'A1',
                    priceTier: 'Standard',
                    price: 499,
                },
            ],
            payment: {},
        });

        processMockPayment.mockResolvedValue({
            success: true,
            transactionId: 'MOCK-SUCCESS-002',
            paidAt: new Date(),
        });

        generateTicketNumber.mockReturnValue('EVT-TICKET-002');
        generateQrToken.mockReturnValue('test-qr-token-002');
        generateQrCode.mockResolvedValue(
            'data:image/png;base64,test'
        );

        Ticket.insertMany.mockResolvedValue([]);

        const session = {
            withTransaction: jest.fn(async (callback) => {
                await callback();
                throw new Error('Simulated transaction failure');
            }),
            endSession: jest.fn().mockResolvedValue(undefined),
        };

        jest.spyOn(mongoose, 'startSession')
            .mockResolvedValue(session);

        const response = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${attendeeToken}`)
            .send({
                eventId: EVENT_ID,
                seatIds: [seatId],
            });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);

        // Payment succeeded before the transaction failed.
        expect(processMockPayment).toHaveBeenCalledWith({
            amount: 499,
        });

        // The booking must be marked failed and payment refunded.
        expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
            'booking-test-id',
            expect.objectContaining({
                $set: expect.objectContaining({
                    status: 'failed',
                    'payment.status': 'refunded',
                    'payment.transactionId': 'MOCK-SUCCESS-002',
                }),
            })
        );

        // Tickets may have been prepared, but the transaction failed.
        expect(Ticket.insertMany).toHaveBeenCalled();

        // The transaction and cleanup should both execute.
        expect(session.withTransaction).toHaveBeenCalled();
        expect(session.endSession).toHaveBeenCalled();

        // Recovery should attempt to release the attendee's seat.
        expect(Seat.findOneAndUpdate).toHaveBeenCalled();
    });
      test('should handle payment processing exceptions', async () => {
    const seatId = '507f1f77bcf86cd799439012';

    const seat = {
      _id: seatId,
      event: EVENT_ID,
      seatNumber: 'A1',
      row: 'A',
      status: 'held',
      heldBy: ATTENDEE_ID,
      holdExpiresAt: new Date(Date.now() + 120000),
      priceTier: 'Standard',
      price: 499,
    };

    Event.findById.mockResolvedValue({
      _id: EVENT_ID,
      name: 'EventHub Test Event',
    });

    Seat.find.mockResolvedValue([seat]);

    Booking.create.mockResolvedValue({
      _id: 'booking-test-id',
      bookingReference: 'EVT-TEST-003',
      event: EVENT_ID,
      seats: [
        {
          seat: seatId,
          seatNumber: 'A1',
          priceTier: 'Standard',
          price: 499,
        },
      ],
      payment: {},
    });

    processMockPayment.mockRejectedValue(
      new Error('Simulated payment service error')
    );

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: [seatId],
      });

    expect(response.status).toBe(502);
    expect(response.body.success).toBe(false);

    expect(Booking.create).toHaveBeenCalled();

    expect(processMockPayment).toHaveBeenCalledWith({
      amount: 499,
    });

    // The booking should be marked failed.
    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
      'booking-test-id',
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          'payment.status': 'failed',
        }),
      })
    );

    // No tickets should be generated.
    expect(Ticket.insertMany).not.toHaveBeenCalled();

    // Confirmation transaction should not start.
    expect(mongoose.startSession).not.toHaveBeenCalled();

    // The attendee's held seat should be released.
    expect(Seat.findOneAndUpdate).toHaveBeenCalled();
  });
    test('should refund payment when seat hold is lost during transaction', async () => {
    const seatId = '507f1f77bcf86cd799439012';

    const seat = {
      _id: seatId,
      event: EVENT_ID,
      seatNumber: 'A1',
      row: 'A',
      status: 'held',
      heldBy: ATTENDEE_ID,
      holdExpiresAt: new Date(Date.now() + 120000),
      priceTier: 'Standard',
      price: 499,
    };

    Event.findById.mockResolvedValue({
      _id: EVENT_ID,
      name: 'EventHub Test Event',
    });

    // Initial validation succeeds.
    // Transaction recheck finds that the hold is gone.
    Seat.find
      .mockImplementationOnce(() => Promise.resolve([seat]))
      .mockImplementationOnce(() => ({
        session: jest.fn().mockResolvedValue([]),
      }));

    Booking.create.mockResolvedValue({
      _id: 'booking-test-id',
      bookingReference: 'EVT-TEST-004',
      event: EVENT_ID,
      seats: [
        {
          seat: seatId,
          seatNumber: 'A1',
          priceTier: 'Standard',
          price: 499,
        },
      ],
      payment: {},
    });

    processMockPayment.mockResolvedValue({
      success: true,
      transactionId: 'MOCK-SUCCESS-004',
      paidAt: new Date(),
    });

    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(mongoose, 'startSession')
      .mockResolvedValue(session);

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        eventId: EVENT_ID,
        seatIds: [seatId],
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);

    expect(processMockPayment).toHaveBeenCalledWith({
      amount: 499,
    });

    // Payment must be refunded because confirmation failed.
    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
      'booking-test-id',
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          'payment.status': 'refunded',
          'payment.transactionId': 'MOCK-SUCCESS-004',
        }),
      })
    );

    // No tickets should be inserted.
    expect(Ticket.insertMany).not.toHaveBeenCalled();

    expect(session.withTransaction).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();

    // Recovery attempts to release any remaining attendee hold.
    expect(Seat.findOneAndUpdate).toHaveBeenCalled();
  });
  test('should reject requests without authentication for booking history', async () => {
    const response = await request(app)
      .get('/api/bookings/my-bookings');

    expect(response.status).toBe(401);
    expect(Booking.find).not.toHaveBeenCalled();
  });

  test('should reject organizers accessing attendee booking history', async () => {
    const response = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', `Bearer ${organizerToken}`);

    expect(response.status).toBe(403);
    expect(Booking.find).not.toHaveBeenCalled();
  });

  test('should return an empty booking history for an attendee with no bookings', async () => {
    const response = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', `Bearer ${attendeeToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.bookings).toEqual([]);
    expect(response.body.data.upcomingBookings).toEqual([]);
    expect(response.body.data.pastBookings).toEqual([]);

    expect(Booking.find).toHaveBeenCalledWith({
      attendee: ATTENDEE_ID,
    });
  });

test('should return booking history with event dates and ticket QR codes', async () => {
  const upcomingDate = new Date(Date.now() + 86400000);
  const pastDate = new Date(Date.now() - 86400000);

  const upcomingBooking = {
    _id: 'booking-upcoming',
    bookingReference: 'EVT-UPCOMING-001',
    status: 'confirmed',
    totalAmount: 998,
    payment: { status: 'successful' },
    createdAt: new Date(),
    confirmedAt: new Date(),
    event: {
      _id: EVENT_ID,
      name: 'Upcoming Technology Event',
      date: upcomingDate,
      venue: 'Hyderabad',
      category: 'Technology',
    },
    seats: [],
  };

  const pastBooking = {
    _id: 'booking-past',
    bookingReference: 'EVT-PAST-001',
    status: 'confirmed',
    totalAmount: 499,
    payment: { status: 'successful' },
    createdAt: new Date(),
    confirmedAt: new Date(),
    event: {
      _id: EVENT_ID,
      name: 'Past Technology Event',
      date: pastDate,
      venue: 'Hyderabad',
      category: 'Technology',
    },
    seats: [],
  };

  Booking.find.mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([
      upcomingBooking,
      pastBooking,
    ]),
  });

  Ticket.find.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([
      {
        booking: 'booking-upcoming',
        ticketNumber: 'TKT-001',
        seatNumber: 'A1',
        price: 499,
        status: 'valid',
        qrToken: 'valid-qr-token',
        checkedInAt: null,
      },
      {
        booking: 'booking-upcoming',
        ticketNumber: 'TKT-002',
        seatNumber: 'A2',
        price: 499,
        status: 'used',
        qrToken: 'used-qr-token',
        checkedInAt: new Date(),
      },
      {
        booking: 'booking-upcoming',
        ticketNumber: 'TKT-003',
        seatNumber: 'A3',
        price: 499,
        status: 'cancelled',
        qrToken: 'cancelled-qr-token',
        checkedInAt: null,
      },
    ]),
  });

  generateQrCode.mockResolvedValue(
    'data:image/png;base64,test-qr'
  );

  const response = await request(app)
    .get('/api/bookings/my-bookings')
    .set('Authorization', `Bearer ${attendeeToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const data = response.body.data;

  expect(data.bookings).toHaveLength(2);
  expect(data.upcomingBookings).toHaveLength(1);
  expect(data.pastBookings).toHaveLength(1);

  expect(data.upcomingBookings[0].event.name)
    .toBe('Upcoming Technology Event');

  expect(data.pastBookings[0].event.name)
    .toBe('Past Technology Event');

  const tickets = data.upcomingBookings[0].tickets;

  expect(tickets).toHaveLength(3);

  expect(tickets[0].status).toBe('valid');
  expect(tickets[0].qrCode)
    .toBe('data:image/png;base64,test-qr');

  expect(tickets[1].status).toBe('used');
  expect(tickets[1].qrCode).toBeNull();

  expect(tickets[2].status).toBe('cancelled');
  expect(tickets[2].qrCode).toBeNull();

  expect(tickets[0]).not.toHaveProperty('qrToken');
  expect(tickets[1]).not.toHaveProperty('qrToken');
  expect(tickets[2]).not.toHaveProperty('qrToken');

  expect(generateQrCode).toHaveBeenCalledTimes(1);
  expect(generateQrCode).toHaveBeenCalledWith('valid-qr-token');
});

test('should cancel a confirmed booking, refund payment, cancel tickets, and release seats', async () => {
  const bookingId = '507f1f77bcf86cd799439012';
  const seatId = '507f1f77bcf86cd799439013';
  const futureEventDate = new Date(Date.now() + 86400000);

  const booking = {
    _id: bookingId,
    attendee: ATTENDEE_ID,
    bookingReference: 'EVT-CANCEL-001',
    status: 'confirmed',
    totalAmount: 499,
    payment: {
      status: 'successful',
    },
    event: {
      _id: EVENT_ID,
      date: futureEventDate,
    },
    seats: [
      {
        seat: seatId,
        seatNumber: 'A1',
        price: 499,
      },
    ],
  };

  const tickets = [
    {
      ticketNumber: 'TKT-CANCEL-001',
      booking: bookingId,
      status: 'valid',
      checkedInAt: null,
    },
  ];

  const bookedSeats = [
    {
      _id: seatId,
      event: EVENT_ID,
      seatNumber: 'A1',
      row: 'A',
      status: 'booked',
      heldBy: null,
      holdExpiresAt: null,
    },
  ];

  // Mock MongoDB transaction.
  const session = {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  jest.spyOn(mongoose, 'startSession')
    .mockResolvedValue(session);

  // Mock the booking lookup and its chained queries.
  Booking.findOne.mockReturnValue({
    session: jest.fn().mockReturnThis(),
    populate: jest.fn().mockResolvedValue(booking),
  });

  // Mock ticket lookup.
  Ticket.find.mockReturnValue({
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(tickets),
  });

  // Mock booked-seat lookup.
  Seat.find.mockReturnValue({
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(bookedSeats),
  });

  Ticket.updateMany.mockResolvedValue({
    matchedCount: 1,
    modifiedCount: 1,
  });

  Seat.updateMany.mockResolvedValue({
    matchedCount: 1,
    modifiedCount: 1,
  });

  Booking.updateOne.mockResolvedValue({
    matchedCount: 1,
    modifiedCount: 1,
  });

  const response = await request(app)
    .post(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${attendeeToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.booking.status).toBe('cancelled');
  expect(response.body.booking.refund.amount).toBe(499);
  expect(response.body.booking.refund.transactionId)
    .toMatch(/^MOCK-REFUND-/);

  // Confirm that the booking lookup is attendee-specific.
  expect(Booking.findOne).toHaveBeenCalledWith({
    _id: bookingId,
    attendee: ATTENDEE_ID,
    status: 'confirmed',
  });

  // Confirm that valid tickets were cancelled.
  expect(Ticket.updateMany).toHaveBeenCalledWith(
    {
      booking: bookingId,
      status: 'valid',
      checkedInAt: null,
    },
    {
      $set: {
        status: 'cancelled',
      },
    },
    { session }
  );

  // Confirm that only the booking's booked seats were released.
  expect(Seat.updateMany).toHaveBeenCalledWith(
    {
      _id: { $in: [seatId] },
      event: EVENT_ID,
      status: 'booked',
    },
    {
      $set: {
        status: 'available',
        heldBy: null,
        holdExpiresAt: null,
      },
    },
    { session }
  );

  // Confirm the simulated refund was recorded.
  expect(Booking.updateOne).toHaveBeenCalledWith(
    {
      _id: bookingId,
      attendee: ATTENDEE_ID,
      status: 'confirmed',
    },
    {
      $set: expect.objectContaining({
        status: 'cancelled',
        'payment.status': 'refunded',
        'payment.refund.transactionId':
          response.body.booking.refund.transactionId,
        'payment.refund.amount': 499,
      }),
    },
    { session }
  );

  expect(session.withTransaction).toHaveBeenCalled();
  expect(session.endSession).toHaveBeenCalled();
});

test('should reject cancellation without authentication', async () => {
  const response = await request(app)
    .post('/api/bookings/507f1f77bcf86cd799439012/cancel');

  expect(response.status).toBe(401);
  expect(Booking.findOne).not.toHaveBeenCalled();
});

test('should reject cancellation requests from organizers', async () => {
  const response = await request(app)
    .post('/api/bookings/507f1f77bcf86cd799439012/cancel')
    .set('Authorization', `Bearer ${organizerToken}`);

  expect(response.status).toBe(403);
  expect(Booking.findOne).not.toHaveBeenCalled();
});

test('should reject an invalid booking ID for cancellation', async () => {
  const response = await request(app)
    .post('/api/bookings/invalid-booking-id/cancel')
    .set('Authorization', `Bearer ${attendeeToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(Booking.findOne).not.toHaveBeenCalled();
});

test('should reject cancellation when the booking does not exist or belong to the attendee', async () => {
  const bookingId = '507f1f77bcf86cd799439012';

  Booking.findOne.mockReturnValue({
    session: jest.fn().mockReturnThis(),
    populate: jest.fn().mockResolvedValue(null),
  });

  const session = {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  jest.spyOn(mongoose, 'startSession')
    .mockResolvedValue(session);

  const response = await request(app)
    .post(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${attendeeToken}`);

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
  expect(Ticket.updateMany).not.toHaveBeenCalled();
  expect(Seat.updateMany).not.toHaveBeenCalled();
  expect(Booking.updateOne).not.toHaveBeenCalled();
  expect(session.endSession).toHaveBeenCalled();
});

test('should reject cancellation when the event has already passed', async () => {
  const bookingId = '507f1f77bcf86cd799439012';

  const booking = {
    _id: bookingId,
    attendee: ATTENDEE_ID,
    status: 'confirmed',
    payment: { status: 'successful' },
    event: {
      _id: EVENT_ID,
      date: new Date(Date.now() - 86400000),
    },
    seats: [{ seat: '507f1f77bcf86cd799439013' }],
  };

  const session = {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  jest.spyOn(mongoose, 'startSession')
    .mockResolvedValue(session);

  Booking.findOne.mockReturnValue({
    session: jest.fn().mockReturnThis(),
    populate: jest.fn().mockResolvedValue(booking),
  });

  const response = await request(app)
    .post(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${attendeeToken}`);

  expect(response.status).toBe(409);
  expect(response.body.success).toBe(false);
  expect(Ticket.find).not.toHaveBeenCalled();
  expect(Ticket.updateMany).not.toHaveBeenCalled();
  expect(Seat.updateMany).not.toHaveBeenCalled();
  expect(Booking.updateOne).not.toHaveBeenCalled();
  expect(session.endSession).toHaveBeenCalled();
});

test('should reject cancellation when a ticket has already been used', async () => {
  const bookingId = '507f1f77bcf86cd799439012';

  const booking = {
    _id: bookingId,
    attendee: ATTENDEE_ID,
    status: 'confirmed',
    payment: { status: 'successful' },
    event: {
      _id: EVENT_ID,
      date: new Date(Date.now() + 86400000),
    },
    seats: [{ seat: '507f1f77bcf86cd799439013' }],
  };

  const session = {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  jest.spyOn(mongoose, 'startSession')
    .mockResolvedValue(session);

  Booking.findOne.mockReturnValue({
    session: jest.fn().mockReturnThis(),
    populate: jest.fn().mockResolvedValue(booking),
  });

  Ticket.find.mockReturnValue({
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([
      {
        booking: bookingId,
        status: 'used',
        checkedInAt: new Date(),
      },
    ]),
  });

  const response = await request(app)
    .post(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${attendeeToken}`);

  expect(response.status).toBe(409);
  expect(response.body.success).toBe(false);
  expect(Ticket.updateMany).not.toHaveBeenCalled();
  expect(Seat.updateMany).not.toHaveBeenCalled();
  expect(Booking.updateOne).not.toHaveBeenCalled();
  expect(session.endSession).toHaveBeenCalled();
});
});
