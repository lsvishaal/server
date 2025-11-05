import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

interface ICollaborator {
  user: mongoose.Types.ObjectId;
  permission: 'owner' | 'editor' | 'viewer';
}

export interface IDocumentModel extends Document {
  title: string;
  content: string;
  owner: mongoose.Types.ObjectId;
  collaborators: ICollaborator[];
  shareToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocumentModel>({
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    default: 'Untitled Document'
  },
  content: {
    type: String,
    default: ''
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'viewer'
    }
  }],
  shareToken: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Generate unique share token
documentSchema.methods.generateShareToken = function() {
  this.shareToken = crypto.randomBytes(16).toString('hex');
  return this.shareToken;
};

// Index for better query performance
documentSchema.index({ owner: 1, createdAt: -1 });
documentSchema.index({ 'collaborators.user': 1 });

export default mongoose.model<IDocumentModel>('Document', documentSchema);
