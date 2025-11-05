import express, { Application, Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Import configurations
import { connectDatabase } from './config/database';
import { setupCollaborationSocket } from './websockets/collaborationHandler';
import { sanitizeInput } from './middleware/sanitize';
import logger from './utils/logger';
import { loggingMiddleware } from './middleware/logging';

// Import routes
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import aiRoutes from './routes/ai';

// Initialize Express app
const app: Application = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001'
];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Setup WebSocket handlers
setupCollaborationSocket(io);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Sanitize input to prevent XSS
app.use(sanitizeInput);

// Logging middleware (after body parser, before routes)
app.use(loggingMiddleware);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Import mongoose to check connection
    const mongoose = require('mongoose');
    
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.status(200).json({
      success: true,
      message: 'Server is running',
      timestamp: new Date(),
      database: {
        status: dbStatus,
        connected: dbStatus === 'connected'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server health check failed',
      database: {
        status: 'error',
        connected: false
      }
    });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Collaborative Text Editor API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      documents: '/api/documents',
      ai: '/api/ai'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error('Request error', {
    error_type: err.constructor?.name || 'Error',
    error_message: err.message,
    stack_trace: err.stack,
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    user_id: (req as any).user?.id,
    status_code: err.status || 500
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        api_url: `http://localhost:${PORT}/api`,
        websocket_url: `ws://localhost:${PORT}`
      });
    });
  } catch (error: any) {
    logger.error('Failed to start server', {
      error_type: error.constructor?.name || 'Error',
      error_message: error.message,
      stack_trace: error.stack
    });
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled promise rejection', {
    error_type: err.constructor?.name || 'Error',
    error_message: err.message,
    stack_trace: err.stack
  });
  httpServer.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', {
    error_type: err.constructor?.name || 'Error',
    error_message: err.message,
    stack_trace: err.stack
  });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

startServer();
