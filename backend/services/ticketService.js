
const { randomUUID, randomBytes } = require('crypto');
const QRCode = require('qrcode');

// Generate one ticket number for each booked seat.
const generateTicketNumber = () => {
  return `EVT-${randomUUID().toUpperCase()}`;
};

// Generate a secure token used by the QR code.
const generateQrToken = () => {
  return randomBytes(32).toString('hex');
};

// Create a QR code image containing the ticket token.
const generateQrCode = async (qrToken) => {
  if (typeof qrToken !== 'string' || !qrToken.trim()) {
    throw new Error('A valid QR token is required');
  }

  return QRCode.toDataURL(qrToken);
};

module.exports = {
  generateTicketNumber,
  generateQrToken,
  generateQrCode,
};
