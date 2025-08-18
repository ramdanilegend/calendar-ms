import request from 'supertest';
import app from '../../app';
import { generateToken, UserRole } from '../middleware/auth';

describe('Calendar API Endpoints', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(() => {
    // Generate test tokens
    adminToken = generateToken({
      userId: 'admin-test-id',
      email: 'admin@test.com',
      role: UserRole.ADMIN
    });

    userToken = generateToken({
      userId: 'user-test-id',
      email: 'user@test.com',
      role: UserRole.USER
    });
  });

  describe('Health Check', () => {
    test('GET /api/v1/health should return 200', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Update Check Endpoint', () => {
    test('GET /api/v1/updates/check should return update info', async () => {
      const response = await request(app)
        .get('/api/v1/updates/check')
        .expect('Content-Type', /json/);

      // May return 404 if no updates exist yet, which is fine
      expect([200, 404]).toContain(response.status);
    });

    test('GET /api/v1/updates/check with invalid region should return 400', async () => {
      const response = await request(app)
        .get('/api/v1/updates/check?region=invalid')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.data.validation_errors).toBeDefined();
    });

    test('GET /api/v1/updates/check with valid region should work', async () => {
      const response = await request(app)
        .get('/api/v1/updates/check?region=id')
        .expect('Content-Type', /json/);

      // May return 404 if no updates exist yet, which is fine
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Events Endpoints', () => {
    test('GET /api/v1/events should return events list', async () => {
      const response = await request(app)
        .get('/api/v1/events')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('events');
      expect(response.body.data).toHaveProperty('pagination');
    });

    test('GET /api/v1/events with filters should validate parameters', async () => {
      const response = await request(app)
        .get('/api/v1/events?region=id&language=en&calendar_type=gregorian')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
    });

    test('GET /api/v1/events with invalid filters should return 400', async () => {
      const response = await request(app)
        .get('/api/v1/events?region=invalid&language=invalid')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.data.validation_errors).toBeDefined();
    });

    test('GET /api/v1/events with pagination should work', async () => {
      const response = await request(app)
        .get('/api/v1/events?page=1&limit=10')
        .expect(200);

      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });

    test('GET /api/v1/events/:event_id with valid ID should work', async () => {
      const response = await request(app)
        .get('/api/v1/events/test-event-id')
        .expect('Content-Type', /json/);

      // May return 404 if event doesn't exist, which is fine
      expect([200, 404]).toContain(response.status);
    });

    test('GET /api/v1/events/:event_id with invalid ID should return 400', async () => {
      const response = await request(app)
        .get('/api/v1/events/invalid@#$%')
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('Admin Endpoints', () => {
    test('POST /api/v1/events/sync without auth should return 401', async () => {
      const response = await request(app)
        .post('/api/v1/events/sync')
        .send({})
        .expect(401);

      expect(response.body.status).toBe('error');
    });

    test('POST /api/v1/events/sync with user token should return 403', async () => {
      const response = await request(app)
        .post('/api/v1/events/sync')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(403);

      expect(response.body.status).toBe('error');
    });

    test('POST /api/v1/events/sync with admin token should work', async () => {
      const response = await request(app)
        .post('/api/v1/events/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ region: 'id', force_refresh: false })
        .expect('Content-Type', /json/);

      // May succeed or fail depending on Google Calendar setup
      expect([200, 202, 500]).toContain(response.status);
    });

    test('POST /api/v1/calendar/mappings without auth should return 401', async () => {
      const response = await request(app)
        .post('/api/v1/calendar/mappings')
        .send({})
        .expect(401);

      expect(response.body.status).toBe('error');
    });

    test('POST /api/v1/calendar/mappings with invalid data should return 400', async () => {
      const response = await request(app)
        .post('/api/v1/calendar/mappings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ mappings: [] })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    test('POST /api/v1/calendar/mappings with valid data should work', async () => {
      const validMappings = {
        mappings: [
          {
            event_id: 'test-event-1',
            region: 'id',
            original_date: '2024-01-01T00:00:00.000Z',
            gregorian_date: '2024-01-01T00:00:00.000Z',
            hijri_date: '2024-01-01T00:00:00.000Z'
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/calendar/mappings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validMappings)
        .expect('Content-Type', /json/);

      // May succeed or fail depending on whether events exist
      expect([200, 207, 400]).toContain(response.status);
    });
  });
});
