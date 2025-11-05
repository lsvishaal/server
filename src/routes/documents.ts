import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import Document from '../models/Document';
import { protect } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = express.Router();

// All routes are protected
router.use(protect);

// @route   GET /api/documents
// @desc    Get all documents for the logged-in user
// @access  Private
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const documents = await Document.find({
      $or: [
        { owner: req.user?.id },
        { 'collaborators.user': req.user?.id }
      ]
    })
    .populate('owner', 'name email')
    .populate('collaborators.user', 'name email')
    .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching documents',
      error: error.message
    });
  }
});

// @route   GET /api/documents/:id
// @desc    Get a single document
// @access  Private
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if user has access
    const hasAccess = 
      document.owner._id.toString() === req.user?.id ||
      document.collaborators.some(c => c.user._id.toString() === req.user?.id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this document'
      });
    }

    res.status(200).json({
      success: true,
      document
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching document',
      error: error.message
    });
  }
});

// @route   POST /api/documents
// @desc    Create a new document
// @access  Private
router.post(
  '/',
  [
    body('title').optional().trim().isLength({ max: 200 }),
    body('content').optional().isString()
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

      const { title, content } = req.body;

      const document = await Document.create({
        title: title || 'Untitled Document',
        content: content || '',
        owner: req.user?.id,
        collaborators: [{
          user: req.user?.id,
          permission: 'owner'
        }]
      });

      await document.populate('owner', 'name email');

      res.status(201).json({
        success: true,
        document
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error creating document',
        error: error.message
      });
    }
  }
);

// @route   PUT /api/documents/:id
// @desc    Update a document
// @access  Private
router.put(
  '/:id',
  [
    body('title').optional().trim().isLength({ max: 200 }),
    body('content').optional().isString()
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

      const document = await Document.findById(req.params.id);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      // Check if user has edit permission
      const userCollaborator = document.collaborators.find(
        c => c.user.toString() === req.user?.id
      );

      const isOwner = document.owner.toString() === req.user?.id;
      const isEditor = userCollaborator?.permission === 'editor' || userCollaborator?.permission === 'owner';

      if (!isOwner && !isEditor) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to edit this document'
        });
      }

      const { title, content } = req.body;
      
      if (title !== undefined) document.title = title;
      if (content !== undefined) document.content = content;

      await document.save();
      await document.populate('owner', 'name email');
      await document.populate('collaborators.user', 'name email');

      res.status(200).json({
        success: true,
        document
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error updating document',
        error: error.message
      });
    }
  }
);

// @route   DELETE /api/documents/:id
// @desc    Delete a document
// @access  Private (Owner only)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Only owner can delete
    if (document.owner.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the owner can delete this document'
      });
    }

    await document.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error deleting document',
      error: error.message
    });
  }
});

// @route   GET /api/documents/share/:token
// @desc    Get a shared document by share token (read-only)
// @access  Public
router.get('/share/:token', async (req: any, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Share token is required'
      });
    }

    const document = await Document.findOne({ shareToken: token })
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Shared document not found or link has expired'
      });
    }

    res.status(200).json({
      success: true,
      document: {
        _id: document._id,
        title: document.title,
        content: document.content,
        owner: document.owner,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        isShared: true,
        readOnly: true
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching shared document',
      error: error.message
    });
  }
});

// @route   POST /api/documents/:id/share
// @desc    Generate a share link for a document
// @access  Private (Owner only)
router.post('/:id/share', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Only owner can generate share link
    if (document.owner.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the owner can generate a share link'
      });
    }

    // Generate or return existing share token
    if (!document.shareToken) {
      (document as any).generateShareToken();
      await document.save();
    }

    res.status(200).json({
      success: true,
      shareToken: document.shareToken,
      shareUrl: `${process.env.CLIENT_URL}/documents/shared/${document.shareToken}`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error generating share link',
      error: error.message
    });
  }
});

export default router;
