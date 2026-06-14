import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient } from '../config/redis.js';
import { SOCKET_EVENTS } from '../common/Constants.js';
import socketAuth from './socketAuth.js';
import registerPresenceHandlers from './handlers/presence.handler.js';
import registerMessageHandlers from './handlers/message.handler.js';
import registerTypingHandlers from './handlers/typing.handler.js';
import registerCallHandlers from './handlers/call.handler.js';

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN, credentials: true },
    perMessageDeflate: true,
  });

  io.adapter(createAdapter(pubClient, subClient));
  io.use(socketAuth);

  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    registerPresenceHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerCallHandlers(io, socket);
  });

  return io;
};

export const getIo = () => {
  if (!io) throw new Error('Socket.io is not initialized');
  return io;
};
