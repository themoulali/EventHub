
const request = require('supertest');
const app = require('../server');

describe('EventHub Health API', () => {
  test('returns API health status successfully', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      message: 'EventHub API is running',
    });
  });
});
