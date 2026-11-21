
const { randomUUID } = require('crypto');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

const QR_TOKEN_PURPOSE = 'ticket_checkin';
const QR_TOKEN_ISSUER = 'EventHub';
const QR_TOKEN_AUDIENCE = 'EventHub-CheckIn';

// Read the dedicated QR token secret.
const getQrTokenSecret = () => {
  const secret = process.env.QR_TOKEN_SECRET;

  if (!secret) {
    throw new Error('QR_TOKEN_SECRET is not configured');
  }

  return secret;
};

// Generate one ticket number for each booked seat.
const generateTicketNumber = () => {
  return `EVT-${randomUUID().toUpperCase()}`;
};

// Generate a signed token for ticket check-in.
const generateQrToken = ({ ticketNumber, eventId } = {}) => {
  if (!ticketNumber || !eventId) {
    throw new Error('Ticket number and event ID are required');
  }

  return jwt.sign(
    {
      ticketNumber,
      eventId: String(eventId),
      purpose: QR_TOKEN_PURPOSE,
    },
    getQrTokenSecret(),
    {
      expiresIn: '365d',
      issuer: QR_TOKEN_ISSUER,
      audience: QR_TOKEN_AUDIENCE,
    }
  );
};

// Verify the signed QR token.
const verifyQrToken = (token) => {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('A valid QR token is required');
  }

  try {
    const decoded = jwt.verify(token, getQrTokenSecret(), {
      issuer: QR_TOKEN_ISSUER,
      audience: QR_TOKEN_AUDIENCE,
    });

    if (
      decoded.purpose !== QR_TOKEN_PURPOSE ||
      !decoded.ticketNumber ||
      !decoded.eventId
    ) {
      throw new Error('Invalid QR token payload');
    }

    return decoded;
  } catch (error) {
    if (error.message === 'QR_TOKEN_SECRET is not configured') {
      throw error;
    }

    throw new Error('Invalid or expired QR token');
  }
};

// Create a QR code image containing the signed token.
const generateQrCode = async (qrToken) => {
  if (typeof qrToken !== 'string' || !qrToken.trim()) {
    throw new Error('A valid QR token is required');
  }

  return QRCode.toDataURL(qrToken);
};

module.exports = {
  generateTicketNumber,
  generateQrToken,
  verifyQrToken,
  generateQrCode,
};
