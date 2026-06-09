import { verifyAccessToken } from '../services/token.service.js';

const socketAuth = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication token missing'));
    const payload = verifyAccessToken(token);
    socket.user = { id: payload.id, userId: payload.userId };
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
};

export default socketAuth;
