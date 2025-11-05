import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';
import { connectDatabase } from '../config/database';
import User from '../models/User';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

let server: any;

beforeAll(async () => {
  await connectDatabase();
  server = app.listen(5001);
});

afterAll(async () => {
  await User.deleteMany({ email: /test.*@test\.com/ });
  if (server) {
    server.close();
  }
  // Give time for connections to close
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('Authentication API', () => {
  const testUser = {
    name: 'Test User',
    email: `test${Date.now()}@test.com`,
    password: 'test123456'
  };

  let authToken: string;

  test('POST /api/auth/register - should register new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe(testUser.email);
    
    authToken = response.body.token;
  });

  test('POST /api/auth/register - should fail with duplicate email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('already exists');
  });

  test('POST /api/auth/register - should fail with invalid email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test',
        email: 'invalid-email',
        password: 'test123'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  test('POST /api/auth/register - should fail with short password', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test',
        email: 'test@test.com',
        password: '123'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  test('POST /api/auth/login - should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();
    expect(response.body.user).toBeDefined();
  });

  test('POST /api/auth/login - should fail with wrong password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword'
      })
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  test('POST /api/auth/login - should fail with non-existent email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'password123'
      })
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  test('GET /api/auth/me - should get current user', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe(testUser.email);
  });

  test('GET /api/auth/me - should fail without token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  test('POST /api/auth/logout - should logout user', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
