import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Extend Request type to include our custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

// Sample success logs at 10% rate to reduce volume
const shouldLogSuccess = (rate: number = 0.1): boolean => {
  return Math.random() < rate;
};

export const loggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = performance.now();
  const requestId = uuidv4();

  // Attach to request for use in handlers
  req.requestId = requestId;
  req.startTime = start;

  // Log on response finish
  res.on('finish', () => {
    const elapsed = performance.now() - start;
    const statusCode = res.statusCode;

    const logData = {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status_code: statusCode,
      duration_ms: Math.round(elapsed),
      client_ip: req.ip,
      user_agent: req.get('user-agent') || '',
      user_id: (req as any).user?.id
    };

    // Sample success logs (200-299), always log errors/warnings
    if (statusCode >= 200 && statusCode < 300) {
      if (shouldLogSuccess(0.1)) {
        logger.info('Request completed', logData);
      }
    } else if (statusCode >= 300 && statusCode < 400) {
      logger.info('Request redirected', logData);
    } else if (statusCode >= 400 && statusCode < 500) {
      logger.warn('Client error', logData);
    } else {
      logger.error('Server error', logData);
    }
  });

  next();
};
