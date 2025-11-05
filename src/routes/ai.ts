import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth';
import { AuthRequest } from '../types';
import geminiService from '../services/geminiService';

const router = express.Router();

// Per-user AI rate limiter (5 requests per minute per user)
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  keyGenerator: (req: any) => {
    // Use user ID if available, otherwise use IP
    return req.user?.id || req.ip || 'anonymous';
  },
  message: 'Too many AI requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => !req.user // Only apply to authenticated users
});

// All AI routes are protected
router.use(protect);
router.use(aiRateLimiter);

// @route   POST /api/ai/grammar-check
// @desc    Check grammar and style
// @access  Private
router.post(
  '/grammar-check',
  [body('text').notEmpty().withMessage('Text is required')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { text } = req.body;
      const result = await geminiService.grammarCheck(text);

      res.status(200).json({
        success: true,
        result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error checking grammar',
        error: error.message
      });
    }
  }
);

// @route   POST /api/ai/enhance
// @desc    Enhance text quality
// @access  Private
router.post(
  '/enhance',
  [body('text').notEmpty().withMessage('Text is required')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { text } = req.body;
      const result = await geminiService.enhanceText(text);

      res.status(200).json({
        success: true,
        result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error enhancing text',
        error: error.message
      });
    }
  }
);

// @route   POST /api/ai/summarize
// @desc    Summarize text
// @access  Private
router.post(
  '/summarize',
  [body('text').notEmpty().withMessage('Text is required')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { text } = req.body;
      const result = await geminiService.summarizeText(text);

      res.status(200).json({
        success: true,
        result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error summarizing text',
        error: error.message
      });
    }
  }
);

// @route   POST /api/ai/complete
// @desc    Auto-complete text
// @access  Private
router.post(
  '/complete',
  [
    body('text').notEmpty().withMessage('Text is required'),
    body('contextBefore').optional().isString()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { text, contextBefore } = req.body;
      const result = await geminiService.completeText(text, contextBefore);

      res.status(200).json({
        success: true,
        result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error completing text',
        error: error.message
      });
    }
  }
);

// @route   POST /api/ai/suggestions
// @desc    Get writing suggestions
// @access  Private
router.post(
  '/suggestions',
  [
    body('text').notEmpty().withMessage('Text is required'),
    body('type').optional().isString()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { text, type } = req.body;
      const suggestions = await geminiService.getSuggestions(text, type);

      res.status(200).json({
        success: true,
        result: suggestions
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error getting suggestions',
        error: error.message
      });
    }
  }
);

export default router;
