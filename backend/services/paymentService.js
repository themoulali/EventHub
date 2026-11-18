
const { randomUUID } = require('crypto');

// Simulate payment processing without a real payment gateway.
const processMockPayment = async ({
  amount,
  forceFailure = false,
} = {}) => {
  // Validate payment amount.
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new Error('Invalid payment amount');
  }

  // Generate a unique mock transaction reference.
  const transactionId = `MOCK-${randomUUID()}`;

  // Simulate payment failure for controlled testing.
  if (forceFailure) {
    return {
      success: false,
      status: 'failed',
      transactionId,
      paidAt: null,
      message: 'Mock payment failed',
    };
  }

  // Simulate successful payment.
  return {
    success: true,
    status: 'successful',
    transactionId,
    paidAt: new Date(),
    message: 'Mock payment successful',
  };
};

module.exports = {
  processMockPayment,
};
