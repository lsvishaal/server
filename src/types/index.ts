import { Request } from 'express';

export interface IUser {
  _id: string;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IDocument {
  _id: string;
  title: string;
  content: string;
  owner: string;
  collaborators: ICollaborator[];
  shareToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICollaborator {
  user: string;
  permission: 'owner' | 'editor' | 'viewer';
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export interface SocketUser {
  userId: string;
  userName: string;
  color: string;
  cursorPosition?: number;
}

export interface DocumentRoom {
  documentId: string;
  users: Map<string, SocketUser>;
}

export interface TextChange {
  documentId: string;
  userId: string;
  delta: any;
  timestamp: number;
}

export interface CursorUpdate {
  documentId: string;
  userId: string;
  userName: string;
  position: number;
  color: string;
}
