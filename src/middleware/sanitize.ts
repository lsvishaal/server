import { Request, Response, NextFunction } from 'express';

/**
 * Simple XSS sanitization middleware
 * Removes potentially dangerous HTML/JS from request body
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body) {
    sanitizeObject(req.body);
  }
  next();
};

function sanitizeObject(obj: any): void {
  if (!obj || typeof obj !== 'object') return;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        // Remove dangerous patterns
        obj[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .replace(/<iframe[^>]*>/gi, '')
          .replace(/<object[^>]*>/gi, '');
      } else if (typeof value === 'object') {
        sanitizeObject(value);
      }
    }
  }
}
