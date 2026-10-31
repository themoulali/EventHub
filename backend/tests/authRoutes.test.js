
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

const User = require('../models/User');
const app = require('../server');

describe('EventHub Authentication API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-only-secret-for-eventhub';
  });

  describe('POST /api/auth/register', () => {
    test('registers a new attendee successfully', async () => {
      User.findOne.mockResolvedValueOnce(null);

      User.create.mockResolvedValueOnce({
        _id: 'mock-user-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'attendee',
        createdAt: new Date('2026-10-29T12:00:00.000Z'),
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'attendee',
        });

      expect(response.status).toBe(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Registration successful');

      expect(response.body.user).toEqual(
        expect.objectContaining({
          id: 'mock-user-id',
          name: 'Test User',
          email: 'test@example.com',
          role: 'attendee',
        })
      );

      expect(User.create).toHaveBeenCalledTimes(1);
    });
      test('rejects registration when email already exists', async () => {
          User.findOne.mockResolvedValueOnce({
              _id: 'existing-user-id',
              email: 'test@example.com',
          });

          const response = await request(app)
              .post('/api/auth/register')
              .send({
                  name: 'Another User',
                  email: 'test@example.com',
                  password: 'password123',
                  role: 'attendee',
              });

          expect(response.status).toBe(409);

          expect(response.body).toEqual({
              success: false,
              message: 'An account with this email already exists',
          });

          expect(User.create).not.toHaveBeenCalled();
      });
  });
    describe('POST /api/auth/login', () => {
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

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Login successful');

            expect(response.body.token).toEqual(expect.any(String));

            expect(response.body.user).toEqual(
                expect.objectContaining({
                    id: 'mock-user-id',
                    name: 'Test User',
                    email: 'test@example.com',
                    role: 'attendee',
                })
            );

            expect(bcrypt.compare).toHaveBeenCalledWith(
                'password123',
                mockUser.password
            );
        });
    });
    describe('GET /api/auth/me', () => {
        test('returns the authenticated user profile', async () => {
            const token = jwt.sign(
                {
                    sub: 'mock-user-id',
                    role: 'attendee',
                },
                process.env.JWT_SECRET
            );

            const mockUser = {
                _id: 'mock-user-id',
                name: 'Test User',
                email: 'test@example.com',
                role: 'attendee',
                createdAt: new Date('2026-10-29T12:00:00.000Z'),
            };

            User.findById = jest.fn().mockResolvedValueOnce(mockUser);

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);

            expect(response.body.success).toBe(true);

            expect(response.body.user).toEqual(
                expect.objectContaining({
                    id: 'mock-user-id',
                    name: 'Test User',
                    email: 'test@example.com',
                    role: 'attendee',
                })
            );

            expect(User.findById).toHaveBeenCalledWith('mock-user-id');
        });
        test('rejects profile access without an authentication token', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            expect(response.status).toBe(401);

            expect(response.body).toEqual({
                success: false,
                message: 'Authentication required',
            });

            expect(User.findById).not.toHaveBeenCalled();
        });
        test('rejects profile access with an invalid JWT', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(401);

            expect(response.body).toEqual({
                success: false,
                message: 'Invalid or expired token',
            });

            expect(User.findById).not.toHaveBeenCalled();
        });
        test('rejects profile access with an expired JWT', async () => {
            const token = jwt.sign(
                {
                    sub: 'mock-user-id',
                    role: 'attendee',
                },
                process.env.JWT_SECRET,
                { expiresIn: '-1s' }
            );

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(401);

            expect(response.body).toEqual({
                success: false,
                message: 'Invalid or expired token',
            });

            expect(User.findById).not.toHaveBeenCalled();
        });
    });
});
