import http from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/tokens';
import { User } from '../models/User';
import { logger } from '../config/logger';

let io: Server | null = null;

/**
 * Authorized real-time layer. Sockets join rooms scoped by user and
 * organization; cross-organization events are impossible by construction.
 */
export function initSockets(server: http.Server): Server {
  io = new Server(server, {
    cors: { origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()), credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).lean();
      if (!user || user.status !== 'active') return next(new Error('unauthorized'));
      socket.data.userId = String(user._id);
      socket.data.organizationId = user.organizationId ? String(user.organizationId) : null;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    if (socket.data.organizationId) socket.join(`org:${socket.data.organizationId}`);
    logger.debug({ userId: socket.data.userId }, 'socket connected');
  });

  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToOrg(organizationId: string, event: string, payload: unknown): void {
  io?.to(`org:${organizationId}`).emit(event, payload);
}
