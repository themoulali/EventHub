const mockUserSave = jest.fn();

jest.mock('../models/User', () => {
  return jest.fn().mockImplementation((data) => ({
    ...data,
    _id: 'mock-user-id',
    createdAt: new Date('2026-10-29T12:00:00.000Z'),
    save: mockUserSave,
  }));
});

const User = require('../models/User');
User.findOne = jest.fn();
User.create = jest.fn();
const bcrypt = require('bcryptjs');

const { register, login } = require('../controllers/authController');

describe('EventHub Authentication Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-only-secret-for-eventhub';
  });

  describe('register', () => {
    test('rejects a request with missing required fields', async () => {
      const req = {
        body: {
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Name, email, and password are required',
      });
      expect(User).not.toHaveBeenCalled();
    });

    test('rejects an invalid email address', async () => {
      const req = {
        body: {
          name: 'Test User',
          email: 'not-an-email',
          password: 'password123',
          role: 'attendee',
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Please provide a valid email address',
      });
      expect(User).not.toHaveBeenCalled();
    });

      test('creates a user with a normalized email address', async () => {
          User.findOne.mockResolvedValueOnce(null);

          User.create.mockResolvedValueOnce({
              _id: 'mock-user-id',
              name: 'Test User',
              email: 'test@example.com',
              role: 'attendee',
              createdAt: new Date('2026-10-29T12:00:00.000Z'),
          });

      const req = {
        body: {
          name: 'Test User',
          email: '  TEST@example.com ',
          password: 'password123',
          role: 'attendee',
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await register(req, res);

      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'attendee',
        })
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Registration successful',
          user: expect.objectContaining({
            id: 'mock-user-id',
            email: 'test@example.com',
            role: 'attendee',
          }),
        })
      );
    });
  });

    describe('duplicate registration', () => {
    test('rejects an email address that is already registered', async () => {
      User.findOne.mockResolvedValueOnce({
        _id: 'existing-user-id',
        email: 'test@example.com',
      });

      const req = {
        body: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'attendee',
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await register(req, res);

      expect(User.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
      });

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An account with this email already exists',
      });

      expect(User.create).not.toHaveBeenCalled();
    });
  });

    describe('login', () => {
        test('rejects missing email or password', async () => {
            const req = {
                body: {
                    email: 'test@example.com',
                },
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await login(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Email and password are required',
            });
        });

        test('rejects an incorrect password', async () => {
            const mockUser = {
                _id: 'mock-user-id',
                name: 'Test User',
                email: 'test@example.com',
                role: 'attendee',
                password: '$2b$12$mockhashedpassword',
            };

            User.findOne.mockReturnValueOnce({
                select: jest.fn().mockResolvedValueOnce(mockUser),
            });

            jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'wrongpassword',
                },
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await login(req, res);

            expect(bcrypt.compare).toHaveBeenCalledWith(
                'wrongpassword',
                mockUser.password
            );

            expect(res.status).toHaveBeenCalledWith(401);

            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid email or password',
            });
        });

        test('logs in a user with valid credentials', async () => {
            const mockUser = {
                _id: 'mock-user-id',
                name: 'Test User',
                email: 'test@example.com',
                role: 'attendee',
                password: '$2b$12$mockhashedpassword',
            };

            User.findOne.mockReturnValueOnce({
                select: jest.fn().mockResolvedValueOnce(mockUser),
            });

            jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

            const req = {
                body: {
                    email: 'TEST@example.com',
                    password: 'password123',
                },
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await login(req, res);

            expect(User.findOne).toHaveBeenCalledWith({
                email: 'test@example.com',
            });

            expect(bcrypt.compare).toHaveBeenCalledWith(
                'password123',
                mockUser.password
            );

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: 'Login successful',
                    token: expect.any(String),
                    user: expect.objectContaining({
                        id: 'mock-user-id',
                        email: 'test@example.com',
                        role: 'attendee',
                    }),
                })
            );
        });

  // PASTE THE NEW UNKNOWN-EMAIL TEST HERE

  test('rejects an email address that does not exist', async () => {
    User.findOne.mockReturnValueOnce({
      select: jest.fn().mockResolvedValueOnce(null),
    });

    const req = {
      body: {
        email: 'unknown@example.com',
        password: 'password123',
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await login(req, res);

    expect(User.findOne).toHaveBeenCalledWith({
      email: 'unknown@example.com',
    });

    expect(res.status).toHaveBeenCalledWith(401);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid email or password',
    });
  });

}); // End of describe('login')
}); // End of main describe