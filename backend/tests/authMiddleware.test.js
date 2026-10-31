const authMiddleware = require('../middleware/authMiddleware');

describe('EventHub JWT Authentication Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
    process.env.JWT_SECRET = 'test-only-secret-for-eventhub';
  });

  test('rejects requests without an authorization header', () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Authentication required',
    });

    expect(next).not.toHaveBeenCalled();
  });
  test('rejects an invalid JWT token', () => {
  req.headers.authorization = 'Bearer invalid-token';

  authMiddleware(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);

  expect(res.json).toHaveBeenCalledWith({
    success: false,
    message: 'Invalid or expired token',
  });

  expect(next).not.toHaveBeenCalled();
});
test('allows requests with a valid JWT token', () => {
  const jwt = require('jsonwebtoken');

  const token = jwt.sign(
    {
      sub: 'mock-user-id',
      role: 'attendee',
    },
    process.env.JWT_SECRET
  );

  req.headers.authorization = `Bearer ${token}`;

  authMiddleware(req, res, next);

  expect(req.user).toEqual({
    id: 'mock-user-id',
    role: 'attendee',
  });

  expect(next).toHaveBeenCalledTimes(1);
  expect(res.status).not.toHaveBeenCalled();
});
test('rejects an expired JWT token', () => {
  const jwt = require('jsonwebtoken');

  const token = jwt.sign(
    {
      sub: 'mock-user-id',
      role: 'attendee',
    },
    process.env.JWT_SECRET,
    { expiresIn: '-1s' }
  );

  req.headers.authorization = `Bearer ${token}`;

  authMiddleware(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);

  expect(res.json).toHaveBeenCalledWith({
    success: false,
    message: 'Invalid or expired token',
  });

  expect(next).not.toHaveBeenCalled();
});
});