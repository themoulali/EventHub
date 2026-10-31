
const roleMiddleware = require('../middleware/roleMiddleware');

describe('EventHub Role-Based Authorization Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: {
        id: 'mock-user-id',
        role: 'attendee',
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  test('rejects unauthenticated users', () => {
    req.user = undefined;

    roleMiddleware('organizer')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Authentication required',
    });

    expect(next).not.toHaveBeenCalled();
  });

  test('rejects attendees from organizer-only routes', () => {
    roleMiddleware('organizer')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Access forbidden: insufficient permissions',
    });

    expect(next).not.toHaveBeenCalled();
  });

  test('allows organizers to access organizer-only routes', () => {
    req.user.role = 'organizer';

    roleMiddleware('organizer')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('allows attendees to access attendee-only routes', () => {
    roleMiddleware('attendee')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
