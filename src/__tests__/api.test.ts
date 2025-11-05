import request from 'supertest';
import express, { Application } from 'express';
import cors from 'cors';
import authRoutes from '../routes/auth';
import documentRoutes from '../routes/documents';
import aiRoutes from '../routes/ai';
import { connectDatabase } from '../config/database';
import User from '../models/User';
import Document from '../models/Document';

const app: Application = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiRoutes);

let authToken: string;
let userId: string;
let documentId: string;

beforeAll(async () => {
  await connectDatabase();
  // Clean up test data
  await User.deleteMany({ email: /^test.*@testapi\.com$/ });
  await Document.deleteMany({});
}, 30000);

afterAll(async () => {
  await User.deleteMany({ email: /^test.*@testapi\.com$/ });
  await Document.deleteMany({});
  await new Promise(resolve => setTimeout(resolve, 1000));
}, 30000);

describe('🧪 BACKEND API COMPLETE TEST SUITE', () => {
  
  describe('1️⃣ Authentication Tests', () => {
    const testUser = {
      name: 'Test User API',
      email: `test${Date.now()}@testapi.com`,
      password: 'test123456'
    };

    test('Register new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      
      authToken = response.body.token;
      userId = response.body.user.id;
    });

    test('Login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
    });

    test('Get current user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(testUser.email);
    });

    test('Reject invalid login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('Reject unauthorized access', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('2️⃣ Document Management Tests', () => {
    test('Create new document', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Document',
          content: 'This is test content'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.document).toBeDefined();
      expect(response.body.document.title).toBe('Test Document');
      
      documentId = response.body.document._id;
    });

    test('Get all documents', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.documents).toBeDefined();
      expect(response.body.count).toBeGreaterThan(0);
    });

    test('Get single document', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.document.title).toBe('Test Document');
    });

    test('Update document', async () => {
      const response = await request(app)
        .put(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          content: 'Updated content'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.document.title).toBe('Updated Title');
    });

    test('Generate share link', async () => {
      const response = await request(app)
        .post(`/api/documents/${documentId}/share`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.shareToken).toBeDefined();
    });

    test('Reject document access without auth', async () => {
      const response = await request(app)
        .get('/api/documents');

      expect(response.status).toBe(401);
    });
  });

  describe('3️⃣ AI Features Tests', () => {
    const testText = 'This are a test sentence with grammar error.';

    test('AI Grammar Check', async () => {
      const response = await request(app)
        .post('/api/ai/grammar-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: testText });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toBeDefined();
      expect(typeof response.body.result).toBe('string');
    }, 15000);

    test('AI Enhance Text', async () => {
      const response = await request(app)
        .post('/api/ai/enhance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: testText });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toBeDefined();
    }, 15000);

    test('AI Summarize', async () => {
      const longText = 'This is a longer text that needs summarization. ' +
        'It contains multiple sentences and ideas. ' +
        'The AI should provide a concise summary of the main points.';
      
      const response = await request(app)
        .post('/api/ai/summarize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: longText });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toBeDefined();
    }, 15000);

    test('AI Complete Text', async () => {
      const response = await request(app)
        .post('/api/ai/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'The future of AI is' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toBeDefined();
    }, 15000);

    test('AI Get Suggestions', async () => {
      const response = await request(app)
        .post('/api/ai/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: testText });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toBeDefined();
    }, 15000);

    test('Reject AI request without auth', async () => {
      const response = await request(app)
        .post('/api/ai/grammar-check')
        .send({ text: testText });

      expect(response.status).toBe(401);
    });
  });

  describe('4️⃣ Cleanup Tests', () => {
    test('Delete document', async () => {
      const response = await request(app)
        .delete(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Logout user', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
