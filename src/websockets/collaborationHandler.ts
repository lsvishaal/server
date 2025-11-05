import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import Document from '../models/Document';
import logger from '../utils/logger';

interface SocketUser {
  socketId: string;
  userId: string;
  userName: string;
  color: string;
}

interface DocumentRoom {
  documentId: string;
  users: Map<string, SocketUser>;
}

interface DocumentAutoSave {
  documentId: string;
  content: string;
  timeout: NodeJS.Timeout;
}

// Store active document rooms
const documentRooms = new Map<string, DocumentRoom>();
// Store debounced auto-save timers
const autoSaveTimers = new Map<string, DocumentAutoSave>();
// Auto-save interval in milliseconds (30 seconds per requirements)
const AUTO_SAVE_DEBOUNCE_MS = 30000;

// Generate random color for user
const generateUserColor = (): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const setupCollaborationSocket = (io: Server): void => {
  // Middleware to authenticate socket connections
  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        logger.warn('Socket authentication failed - no token', {
          socket_id: socket.id
        });
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);
      socket.data.user = decoded;
      next();
    } catch (error: any) {
      logger.error('Socket authentication failed', {
        socket_id: socket.id,
        error_message: error.message
      });
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user.id;
    
    logger.info('Socket connected', {
      socket_id: socket.id,
      user_id: userId,
      transport: socket.conn.transport.name
    });

    // Join document room
    socket.on('join-document', async (data: { documentId: string; userName: string }) => {
      const start = performance.now();
      
      try {
        const { documentId, userName } = data;

        // Verify user has access to document
        const document = await Document.findById(documentId);
        if (!document) {
          logger.warn('Join document failed - document not found', {
            socket_id: socket.id,
            user_id: userId,
            document_id: documentId
          });
          socket.emit('error', { message: 'Document not found' });
          return;
        }

        const hasAccess =
          document.owner.toString() === userId ||
          document.collaborators.some(c => c.user.toString() === userId);

        if (!hasAccess) {
          logger.warn('Join document failed - access denied', {
            socket_id: socket.id,
            user_id: userId,
            document_id: documentId
          });
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Join the room
        socket.join(documentId);

        // Add user to document room
        if (!documentRooms.has(documentId)) {
          documentRooms.set(documentId, {
            documentId,
            users: new Map()
          });
        }

        const room = documentRooms.get(documentId)!;
        const userColor = generateUserColor();
        
        room.users.set(socket.id, {
          socketId: socket.id,
          userId,
          userName,
          color: userColor
        });

        // Notify others about new user
        socket.to(documentId).emit('user-joined', {
          userId,
          userName,
          color: userColor
        });

        // Send current users to the new user
        const currentUsers = Array.from(room.users.values()).filter(u => u.socketId !== socket.id);
        socket.emit('users-list', currentUsers);

        logger.info('User joined document', {
          socket_id: socket.id,
          user_id: userId,
          document_id: documentId,
          room_users_count: room.users.size,
          elapsed_ms: Math.round(performance.now() - start)
        });
      } catch (error: any) {
        logger.error('Join document failed', {
          socket_id: socket.id,
          user_id: userId,
          document_id: data.documentId,
          error_type: error.constructor?.name || 'Error',
          error_message: error.message,
          elapsed_ms: Math.round(performance.now() - start)
        });
        socket.emit('error', { message: 'Failed to join document' });
      }
    });

    // Handle text changes
    socket.on('text-change', (data: { documentId: string; delta: any; content: string }) => {
      const { documentId, delta, content } = data;
      
      logger.debug('Text change event', {
        socket_id: socket.id,
        user_id: userId,
        document_id: documentId,
        delta_size: JSON.stringify(delta).length,
        content_length: content.length
      });
      
      // Broadcast to all other users in the room immediately (for real-time collab)
      socket.to(documentId).emit('text-change', {
        delta,
        content,
        userId
      });

      // Debounce auto-save to database (30 seconds per requirements)
      // Cancel previous timeout if exists
      if (autoSaveTimers.has(documentId)) {
        const existing = autoSaveTimers.get(documentId)!;
        clearTimeout(existing.timeout);
      }

      // Set new debounced timeout
      const timeout = setTimeout(async () => {
        try {
          await Document.findByIdAndUpdate(documentId, { content }, { new: true });
          
          logger.info('Debounced auto-save completed', {
            document_id: documentId,
            content_length: content.length,
            user_id: userId
          });

          // Remove from map after save
          autoSaveTimers.delete(documentId);
        } catch (err: any) {
          logger.error('Debounced auto-save failed', {
            document_id: documentId,
            user_id: userId,
            error_message: err.message
          });
        }
      }, AUTO_SAVE_DEBOUNCE_MS);

      autoSaveTimers.set(documentId, { documentId, content, timeout });
    });

    // Handle cursor position updates
    socket.on('cursor-move', (data: { documentId: string; position: number }) => {
      const { documentId, position } = data;
      const room = documentRooms.get(documentId);
      
      if (room) {
        const user = room.users.get(socket.id);
        if (user) {
          socket.to(documentId).emit('cursor-move', {
            userId: user.userId,
            userName: user.userName,
            color: user.color,
            position
          });
        }
      }
    });

    // Handle document save
    socket.on('save-document', async (data: { documentId: string; content: string }) => {
      const start = performance.now();
      
      try {
        const { documentId, content } = data;
        
        await Document.findByIdAndUpdate(documentId, { content }, { new: true });
        
        const elapsed = Math.round(performance.now() - start);
        
        logger.info('Document saved', {
          socket_id: socket.id,
          user_id: userId,
          document_id: documentId,
          content_length: content.length,
          elapsed_ms: elapsed
        });
        
        socket.emit('document-saved', { 
          success: true, 
          timestamp: new Date() 
        });

        // Notify all users in the room
        socket.to(documentId).emit('document-saved', { 
          success: true, 
          timestamp: new Date() 
        });
      } catch (error: any) {
        logger.error('Document save failed', {
          socket_id: socket.id,
          user_id: userId,
          document_id: data.documentId,
          error_type: error.constructor?.name || 'Error',
          error_message: error.message,
          elapsed_ms: Math.round(performance.now() - start)
        });
        socket.emit('document-saved', { success: false });
      }
    });

    // Handle leave document
    socket.on('leave-document', (data: { documentId: string }) => {
      const { documentId } = data;
      handleUserLeave(socket, documentId);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info('Socket disconnected', {
        socket_id: socket.id,
        user_id: userId
      });
      
      // Remove user from all document rooms
      documentRooms.forEach((room, documentId) => {
        if (room.users.has(socket.id)) {
          handleUserLeave(socket, documentId);
        }
      });

      // Flush any pending auto-saves for documents this user was editing
      autoSaveTimers.forEach((save, documentId) => {
        clearTimeout(save.timeout);
        autoSaveTimers.delete(documentId);
      });
    });
  });
};

// Helper function to handle user leaving
const handleUserLeave = (socket: Socket, documentId: string): void => {
  const room = documentRooms.get(documentId);
  
  if (room) {
    const user = room.users.get(socket.id);
    
    if (user) {
      room.users.delete(socket.id);
      
      // Notify others
      socket.to(documentId).emit('user-left', {
        userId: user.userId,
        userName: user.userName
      });
      
      logger.info('User left document', {
        socket_id: socket.id,
        user_id: user.userId,
        document_id: documentId,
        room_users_count: room.users.size
      });
    }
    
    // Clean up empty rooms
    if (room.users.size === 0) {
      documentRooms.delete(documentId);
      logger.debug('Document room cleaned up', {
        document_id: documentId
      });
    }
  }
  
  socket.leave(documentId);
};
