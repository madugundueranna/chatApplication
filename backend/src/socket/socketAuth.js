import { verifyAccessToken } from '../services/token.service.js';
import { ACCESS_COOKIE } from '../utils/authCookies.js';

// Minimal cookie reader for the handshake (cookie-parser doesn't run on sockets).
const readCookie = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
};

const socketAuth = (socket, next) => {
  try {
    // Native passes the token in the handshake auth; web relies on the HttpOnly
    // cookie sent with the upgrade request (client uses withCredentials).
    const token =
      socket.handshake.auth?.token ||
      readCookie(socket.handshake.headers?.cookie, ACCESS_COOKIE);
    if (!token) return next(new Error('Authentication token missing'));
    const payload = verifyAccessToken(token);
    socket.user = { id: payload.id, userId: payload.userId };
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
};

export default socketAuth;
