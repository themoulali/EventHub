const request = require('supertest');
const jwt = require('jsonwebtoken');
const Seat = require('../models/Seat');

jest.mock('../models/Event', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../models/Seat', () => ({
  insertMany: jest.fn(),
  find: jest.fn(),
}));

const Event = require('../models/Event');
const app = require('../server');

const EVENT_ID = '507f1f77bcf86cd799439011';
const ORGANIZER_ID = '507f191e810c19729de860ea';
const SECOND_ORGANIZER_ID = '507f191e810c19729de860eb';
const ATTENDEE_ID = '507f191e810c19729de860ec';

const validEventData = {
  name: 'EventHub Tech Conference 2026',
  description: 'A technology conference.',
  date: '2026-12-15T10:00:00.000Z',
  venue: 'Hyderabad International Convention Centre',
  capacity: 100,
  priceTiers: [
    { name: 'Standard', price: 499, quantity: 60 },
    { name: 'VIP', price: 999, quantity: 40 },
  ],
  category: 'Technology',
};

const createToken = (userId, role) =>
  jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET
  );

const organizerToken = () =>
  createToken(ORGANIZER_ID, 'organizer');

const secondOrganizerToken = () =>
  createToken(SECOND_ORGANIZER_ID, 'organizer');

const attendeeToken = () =>
  createToken(ATTENDEE_ID, 'attendee');

const mockEvent = (organizerId = ORGANIZER_ID) => ({
  _id: EVENT_ID,
  ...validEventData,
  organizer: organizerId,
  save: jest.fn().mockResolvedValue(true),
  deleteOne: jest.fn().mockResolvedValue(true),
});

const mockExistingSeats = (seats) => {
  Seat.find.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(seats),
    }),
  });
};

describe('EventHub Event API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-only-secret-for-eventhub';
    Seat.insertMany.mockResolvedValue([]);
  });

  describe('GET /api/events', () => {
    test('returns all events successfully', async () => {
      const events = [mockEvent()];

      Event.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(events),
        }),
      });

      const response = await request(app)
        .get('/api/events');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.events).toHaveLength(1);
    });

    test('filters events by search term', async () => {
      Event.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([]),
        }),
      });

      const response = await request(app)
        .get('/api/events?search=Tech');

      expect(response.status).toBe(200);

      expect(Event.find).toHaveBeenCalledWith({
        name: {
          $regex: 'Tech',
          $options: 'i',
        },
      });
    });

    test('filters events by category', async () => {
      Event.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([]),
        }),
      });

      const response = await request(app)
        .get('/api/events?category=Technology');

      expect(response.status).toBe(200);

      expect(Event.find).toHaveBeenCalledWith({
        category: {
          $regex: '^Technology$',
          $options: 'i',
        },
      });
    });
  });

  describe('GET /api/events/:id', () => {
    test('returns one event successfully', async () => {
      const event = mockEvent();

      Event.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(event),
      });

      const response = await request(app)
        .get(`/api/events/${EVENT_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.event.name).toBe(validEventData.name);
    });

    test('returns 404 when event does not exist', async () => {
      Event.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app)
        .get(`/api/events/${EVENT_ID}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Event not found');
    });
  });

  describe('POST /api/events', () => {
    test('allows an organizer to create an event', async () => {
      const event = mockEvent();

      Event.create.mockResolvedValue(event);

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken()}`)
        .send(validEventData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Event created successfully');

      expect(Event.create).toHaveBeenCalledWith({
        ...validEventData,
        organizer: ORGANIZER_ID,
      });
      // Verify that 100 seats are generated for this event.
      expect(Seat.insertMany).toHaveBeenCalledTimes(1);

      const generatedSeats = Seat.insertMany.mock.calls[0][0];

      expect(generatedSeats).toHaveLength(100);

      expect(generatedSeats[0]).toMatchObject({
        event: EVENT_ID,
        seatNumber: 'A1',
        row: 'A',
        status: 'available',
      });

      expect(generatedSeats[99]).toMatchObject({
        event: EVENT_ID,
        seatNumber: 'J10',
        row: 'J',
        status: 'available',
      });
    });

    test('cleans up the event when seat generation fails', async () => {
      const event = mockEvent();

      Event.create.mockResolvedValue(event);

      Seat.insertMany.mockRejectedValue(
        new Error('Seat generation failed')
      );

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken()}`)
        .send(validEventData);

      expect(response.status).toBe(500);

      expect(Event.create).toHaveBeenCalledTimes(1);
      expect(Seat.insertMany).toHaveBeenCalledTimes(1);
      expect(event.deleteOne).toHaveBeenCalledTimes(1);
    });

    test('rejects event creation when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken()}`)
        .send({
          name: 'Incomplete Event',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(Event.create).not.toHaveBeenCalled();
    });

    test('prevents attendees from creating events', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${attendeeToken()}`)
        .send(validEventData);

      expect(response.status).toBe(403);

      expect(response.body.message).toBe(
        'Access forbidden: insufficient permissions'
      );

      expect(Event.create).not.toHaveBeenCalled();
    });

    test('rejects event creation without authentication', async () => {
      const response = await request(app)
        .post('/api/events')
        .send(validEventData);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authentication required');

      expect(Event.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/events/:id', () => {
    test('allows an organizer to update their own event', async () => {
      const event = mockEvent(ORGANIZER_ID);

      Event.findById.mockResolvedValue(event);

      const response = await request(app)
        .put(`/api/events/${EVENT_ID}`)
        .set('Authorization', `Bearer ${organizerToken()}`)
        .send({
          description: 'Updated event description.',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(event.save).toHaveBeenCalledTimes(1);
    });

    test('prevents another organizer from updating the event', async () => {
      const event = mockEvent(ORGANIZER_ID);

      Event.findById.mockResolvedValue(event);

      const response = await request(app)
        .put(`/api/events/${EVENT_ID}`)
        .set('Authorization', `Bearer ${secondOrganizerToken()}`)
        .send({
          description: 'Unauthorized update.',
        });

      expect(response.status).toBe(403);

      expect(response.body.message).toBe(
        'You are not authorized to modify this event'
      );

      expect(event.save).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/events/:id', () => {
    test('allows an organizer to delete their own event', async () => {
      const event = mockEvent(ORGANIZER_ID);

      Event.findById.mockResolvedValue(event);

      const response = await request(app)
        .delete(`/api/events/${EVENT_ID}`)
        .set('Authorization', `Bearer ${organizerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(event.deleteOne).toHaveBeenCalledTimes(1);
    });

    test('prevents another organizer from deleting the event', async () => {
      const event = mockEvent(ORGANIZER_ID);

      Event.findById.mockResolvedValue(event);

      const response = await request(app)
        .delete(`/api/events/${EVENT_ID}`)
        .set('Authorization', `Bearer ${secondOrganizerToken()}`);

      expect(response.status).toBe(403);

      expect(response.body.message).toBe(
        'You are not authorized to delete this event'
      );

      expect(event.deleteOne).not.toHaveBeenCalled();
    });
  });

  test('generates only additional seats when capacity increases', async () => {
    const event = mockEvent(ORGANIZER_ID);

    Event.findById.mockResolvedValue(event);

    const existingSeats = Array.from({ length: 100 }, (_, index) => ({
      seatNumber: `${String.fromCharCode(65 + Math.floor(index / 10))}${(index % 10) + 1}`,
    }));

    mockExistingSeats(existingSeats);

    const response = await request(app)
      .put(`/api/events/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken()}`)
      .send({ capacity: 120 });

    expect(response.status).toBe(200);
    expect(event.capacity).toBe(120);

    expect(Seat.insertMany).toHaveBeenCalledTimes(1);

    const newSeats = Seat.insertMany.mock.calls[0][0];

    expect(newSeats).toHaveLength(20);
    expect(newSeats[0].seatNumber).toBe('K1');
    expect(newSeats[19].seatNumber).toBe('L10');
  });

  test('rejects capacity reduction when seats already exist', async () => {
    const event = mockEvent(ORGANIZER_ID);

    Event.findById.mockResolvedValue(event);

    mockExistingSeats([{ _id: 'existing-seat-id' }]);

    const response = await request(app)
      .put(`/api/events/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken()}`)
      .send({ capacity: 90 });

    expect(response.status).toBe(400);

    expect(response.body.message).toBe(
      'Event capacity cannot be reduced after seats have been generated'
    );

    expect(event.save).not.toHaveBeenCalled();
    expect(Seat.insertMany).not.toHaveBeenCalled();
  });

  test('does not create duplicate seats when capacity remains unchanged', async () => {
    const event = mockEvent(ORGANIZER_ID);

    Event.findById.mockResolvedValue(event);

    const existingSeats = Array.from({ length: 100 }, (_, index) => ({
      seatNumber: `${String.fromCharCode(65 + Math.floor(index / 10))}${(index % 10) + 1}`,
    }));

    mockExistingSeats(existingSeats);

    const response = await request(app)
      .put(`/api/events/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken()}`)
      .send({ capacity: 100 });

    expect(response.status).toBe(200);
    expect(event.save).toHaveBeenCalledTimes(1);
    expect(Seat.insertMany).not.toHaveBeenCalled();
  });
});