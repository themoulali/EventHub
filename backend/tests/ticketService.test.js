
const jwt = require('jsonwebtoken');

process.env.QR_TOKEN_SECRET = 'eventhub-test-qr-secret-for-jest-only';

const {
  generateTicketNumber,
  generateQrToken,
  verifyQrToken,
  generateQrCode,
} = require('../services/ticketService');

describe('Ticket Service', () => {
  const testSecret = process.env.QR_TOKEN_SECRET;

  afterEach(() => {
    process.env.QR_TOKEN_SECRET = testSecret;
  });

  describe('generateTicketNumber', () => {
    test('should generate a unique ticket number with EVT prefix', () => {
      const firstTicket = generateTicketNumber();
      const secondTicket = generateTicketNumber();

      expect(firstTicket).toMatch(/^EVT-/);
      expect(secondTicket).toMatch(/^EVT-/);
      expect(firstTicket).not.toBe(secondTicket);
    });
  });

  describe('generateQrToken', () => {
    test('should generate a signed QR token containing ticket details', () => {
      const token = generateQrToken({
        ticketNumber: 'EVT-TEST-001',
        eventId: '507f1f77bcf86cd799439011',
      });

      const decoded = jwt.verify(token, testSecret, {
        issuer: 'EventHub',
        audience: 'EventHub-CheckIn',
      });

      expect(decoded.ticketNumber).toBe('EVT-TEST-001');
      expect(decoded.eventId).toBe('507f1f77bcf86cd799439011');
      expect(decoded.purpose).toBe('ticket_checkin');
    });

    test('should reject missing ticket details', () => {
      expect(() => generateQrToken()).toThrow(
        'Ticket number and event ID are required'
      );

      expect(() =>
        generateQrToken({ ticketNumber: 'EVT-TEST-001' })
      ).toThrow('Ticket number and event ID are required');

      expect(() =>
        generateQrToken({ eventId: '507f1f77bcf86cd799439011' })
      ).toThrow('Ticket number and event ID are required');
    });

    test('should reject generation when QR secret is missing', () => {
      delete process.env.QR_TOKEN_SECRET;

      expect(() =>
        generateQrToken({
          ticketNumber: 'EVT-TEST-001',
          eventId: '507f1f77bcf86cd799439011',
        })
      ).toThrow('QR_TOKEN_SECRET is not configured');
    });
  });

  describe('verifyQrToken', () => {
    test('should successfully verify a valid QR token', () => {
      const token = generateQrToken({
        ticketNumber: 'EVT-TEST-002',
        eventId: '507f1f77bcf86cd799439012',
      });

      const decoded = verifyQrToken(token);

      expect(decoded.ticketNumber).toBe('EVT-TEST-002');
      expect(decoded.eventId).toBe('507f1f77bcf86cd799439012');
      expect(decoded.purpose).toBe('ticket_checkin');
    });

    test('should reject an invalid token', () => {
      expect(() => verifyQrToken('invalid-token')).toThrow(
        'Invalid or expired QR token'
      );
    });

    test('should reject a token signed with a different secret', () => {
      const token = jwt.sign(
        {
          ticketNumber: 'EVT-TEST-003',
          eventId: '507f1f77bcf86cd799439013',
          purpose: 'ticket_checkin',
        },
        'another-test-secret',
        {
          expiresIn: '1h',
          issuer: 'EventHub',
          audience: 'EventHub-CheckIn',
        }
      );

      expect(() => verifyQrToken(token)).toThrow(
        'Invalid or expired QR token'
      );
    });

    test('should reject an expired QR token', () => {
      const token = jwt.sign(
        {
          ticketNumber: 'EVT-TEST-004',
          eventId: '507f1f77bcf86cd799439014',
          purpose: 'ticket_checkin',
        },
        testSecret,
        {
          expiresIn: -1,
          issuer: 'EventHub',
          audience: 'EventHub-CheckIn',
        }
      );

      expect(() => verifyQrToken(token)).toThrow(
        'Invalid or expired QR token'
      );
    });

    test('should reject a token with an incorrect purpose', () => {
      const token = jwt.sign(
        {
          ticketNumber: 'EVT-TEST-005',
          eventId: '507f1f77bcf86cd799439015',
          purpose: 'other_action',
        },
        testSecret,
        {
          expiresIn: '1h',
          issuer: 'EventHub',
          audience: 'EventHub-CheckIn',
        }
      );

      expect(() => verifyQrToken(token)).toThrow(
        'Invalid or expired QR token'
      );
    });

    test('should reject an empty token', () => {
      expect(() => verifyQrToken('')).toThrow(
        'A valid QR token is required'
      );
    });

    test('should reject verification when QR secret is missing', () => {
      const token = generateQrToken({
        ticketNumber: 'EVT-TEST-006',
        eventId: '507f1f77bcf86cd799439016',
      });

      delete process.env.QR_TOKEN_SECRET;

      expect(() => verifyQrToken(token)).toThrow(
        'QR_TOKEN_SECRET is not configured'
      );
    });
  });

  describe('generateQrCode', () => {
    test('should generate a QR code data URL', async () => {
      const qrCode = await generateQrCode('test-qr-token');

      expect(qrCode).toMatch(/^data:image\/png;base64,/);
    });

    test('should reject an empty QR token', async () => {
      await expect(generateQrCode('')).rejects.toThrow(
        'A valid QR token is required'
      );
    });
  });
});
