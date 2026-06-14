// Socket.io service (singleton).
//
// Connects to the ROOT origin (not /api) with the access token in the handshake.
// A listener registry lets providers subscribe before the socket exists and keeps
// their handlers across reconnects/recreations. On an auth `connect_error` (expired
// access token) we refresh the token once and reconnect with it, so a long-lived
// session never silently goes dead on the 15-minute access-token expiry.

import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "./config";
import { refreshAccessToken } from "./session";

// Event names — mirror backend src/common/Constants.js SOCKET_EVENTS.
export const EVT = {
  MESSAGE_NEW: "message:new",
  MESSAGE_READ: "message:read",
  MESSAGE_SEND: "message:send",
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  USER_STATUS: "user:status",
  CALL_INITIATE: "call:initiate",
  CALL_INCOMING: "call:incoming",
  CALL_ACCEPT: "call:accept",
  CALL_ACCEPTED: "call:accepted",
  CALL_REJECT: "call:reject",
  CALL_REJECTED: "call:rejected",
  CALL_OFFER: "call:offer",
  CALL_ANSWER: "call:answer",
  CALL_ICE_CANDIDATE: "call:ice-candidate",
  CALL_ICE_SERVERS: "call:ice-servers",
  CALL_END: "call:end",
  CALL_ENDED: "call:ended",
  CALL_MISSED: "call:missed",
  CALL_BUSY: "call:busy",
  CALL_ERROR: "call:error",
  NOTIFICATION_NEW: "notification:new",
  STORY_NEW: "story:new",
  STORY_VIEWED: "story:viewed",
} as const;

type Handler = (...args: any[]) => void;

let socket: Socket | null = null;
const handlers = new Map<string, Set<Handler>>();

// (Re)bind every registered handler onto a freshly created socket.
function bindRegistry(s: Socket): void {
  for (const [event, set] of handlers) {
    for (const handler of set) s.on(event, handler);
  }
}

// `token` is optional: native passes the access token in the handshake; web omits
// it and authenticates via the HttpOnly cookie sent with the upgrade request
// (withCredentials). The server's socketAuth accepts either.
export function connect(token?: string): Socket {
  const auth = token ? { token } : {};
  if (socket) {
    socket.auth = auth;
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth,
    withCredentials: true,
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  socket.on("connect_error", async (err: Error) => {
    if (!/token|auth|expired|missing/i.test(err?.message || "")) return;
    try {
      const fresh = await refreshAccessToken();
      if (socket) {
        // Native reconnects with the new token; web's cookie was refreshed
        // server-side, so just reconnect.
        socket.auth = token ? { token: fresh } : {};
        socket.connect();
      }
    } catch {
      // Refresh failed — the REST layer will force logout. Stop hammering.
      socket?.disconnect();
    }
  });

  bindRegistry(socket);
  return socket;
}

export function disconnect(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function isConnected(): boolean {
  return Boolean(socket?.connected);
}

// Subscribe. Works before connect (registered, bound on connect) and returns an
// unsubscribe. Handlers persist across reconnects.
export function on(event: string, handler: Handler): () => void {
  let set = handlers.get(event);
  if (!set) handlers.set(event, (set = new Set()));
  set.add(handler);
  socket?.on(event, handler);
  return () => off(event, handler);
}

export function off(event: string, handler: Handler): void {
  handlers.get(event)?.delete(handler);
  socket?.off(event, handler);
}

export function emit(event: string, payload?: unknown): void {
  socket?.emit(event, payload);
}

// Emit and await the server ack (the chat/call protocols ack with { success, ... }).
export function emitWithAck<T = any>(
  event: string,
  payload?: unknown,
  timeoutMs = 15000
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error("Socket is not connected"));
    socket
      .timeout(timeoutMs)
      .emit(event, payload, (err: Error | null, ack: T) => {
        if (err) return reject(err);
        resolve(ack);
      });
  });
}
