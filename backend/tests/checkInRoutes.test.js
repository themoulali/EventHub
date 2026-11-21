const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/Event', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/Ticket', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../services/ticketService', () => ({
  verifyQrToken: jest.fn(),
}));

jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => null),
}));

const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { verifyQrToken } = require('../services/ticketService');
const { getIO } = require('../config/socket');

const app = require('../server');

const EVENT_ID = '507f1f77bcf86cd799439011';
const ORGANIZER_ID = '507f191e810c19729de860ea';
const OTHER_ORGANIZER_ID = '507f191e810c19729de860eb';
const ATTENDEE_ID = '507f191e810c19729de860ec';

const QR_TOKEN = 'test-valid-qr-token';

const createToken = (userId, role) =>
  jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET
  );

const createTicket = (overrides = {}) => ({
  _id: 'ticket-test-id',
  ticketNumber: 'EVT-TEST-001',
  qrToken: QR_TOKEN,
  status: 'valid',
  checkedInAt: null,
  seatNumber: 'A1',
  ...overrides,
});

describe('Check-in routes', () => {
  let organizerToken;
  let attendeeToken;
  let event;
  let ticket;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.JWT_SECRET = 'test-only-secret-for-checkin';

    organizerToken = createToken(ORGANIZER_ID, 'organizer');
    attendeeToken = createToken(ATTENDEE_ID, 'attendee');

    event = {
      _id: EVENT_ID,
      name: 'Technology Conference',
      organizer: {
        toString: () => ORGANIZER_ID,
      },
      capacity: 100,
    };

    ticket = createTicket();

    Event.findById.mockResolvedValue(event);

    Ticket.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(ticket),
    });

    Ticket.updateOne.mockResolvedValue({
      modifiedCount: 1,
    });

    Ticket.countDocuments.mockResolvedValue(1);

    verifyQrToken.mockReturnValue({
      ticketNumber: ticket.ticketNumber,
      eventId: EVENT_ID,
    });

    getIO.mockReturnValue(null);
  });

  test('should reject requests without authentication', async () => {
    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(401);
    expect(Event.findById).not.toHaveBeenCalled();
  });

  test('should reject attendees who try to check in tickets', async () => {
    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(403);
  });

  test('should reject an invalid event ID', async () => {
    const response = await request(app)
      .post('/api/check-in/invalid-id')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(400);
    expect(Event.findById).not.toHaveBeenCalled();
  });

  test('should return 404 when the event does not exist', async () => {
    Event.findById.mockResolvedValue(null);

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(404);
  });

  test('should reject an organizer who does not own the event', async () => {
    event.organizer.toString = () => OTHER_ORGANIZER_ID;

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(403);
    expect(verifyQrToken).not.toHaveBeenCalled();
  });

  test('should reject a missing QR token', async () => {
    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(verifyQrToken).not.toHaveBeenCalled();
  });

  test('should reject an invalid QR token', async () => {
    verifyQrToken.mockImplementation(() => {
      throw new Error('Invalid or expired QR token');
    });

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid or expired/i);
  });

  test('should reject a QR token belonging to another event', async () => {
    verifyQrToken.mockReturnValue({
      ticketNumber: ticket.ticketNumber,
      eventId: '507f1f77bcf86cd799439012',
    });

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(400);
    expect(Ticket.findOne).not.toHaveBeenCalled();
  });

  test('should reject a ticket that cannot be found', async () => {
    Ticket.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(404);
  });

  test('should reject a cancelled ticket', async () => {
    ticket.status = 'cancelled';

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(400);
    expect(Ticket.updateOne).not.toHaveBeenCalled();
  });

  test('should reject a ticket that has already been checked in', async () => {
    ticket.status = 'used';

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(409);
    expect(Ticket.updateOne).not.toHaveBeenCalled();
  });

  test('should reject a ticket when its stored QR token does not match', async () => {
    ticket.qrToken = 'different-stored-token';

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(404);
    expect(Ticket.updateOne).not.toHaveBeenCalled();
  });

  test('should successfully check in a valid ticket', async () => {
    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.ticketNumber).toBe(ticket.ticketNumber);
    expect(response.body.data.checkedInCount).toBe(1);

    expect(Ticket.updateOne).toHaveBeenCalledWith(
      {
        _id: ticket._id,
        status: 'valid',
        checkedInAt: null,
      },
      {
        $set: expect.objectContaining({
          status: 'used',
          checkedInAt: expect.any(Date),
        }),
      }
    );

    expect(Ticket.countDocuments).toHaveBeenCalledWith({
      event: EVENT_ID,
      status: 'used',
    });
  });

  test('should broadcast updated attendance through Socket.IO', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });

    getIO.mockReturnValue({ to });

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(200);
    expect(to).toHaveBeenCalledWith(`event:${EVENT_ID}`);
    expect(emit).toHaveBeenCalledWith(
      'attendanceUpdated',
      {
        eventId: EVENT_ID,
        checkedInCount: 1,
        capacity: 100,
      }
    );
  });

  test('should reject a duplicate check-in detected by the atomic update', async () => {
    Ticket.updateOne.mockResolvedValue({
      modifiedCount: 0,
    });

    const response = await request(app)
      .post(`/api/check-in/${EVENT_ID}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ token: QR_TOKEN });

    expect(response.status).toBe(409);
    expect(Ticket.countDocuments).not.toHaveBeenCalled();
  });
});
