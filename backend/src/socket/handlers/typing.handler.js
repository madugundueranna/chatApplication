import Conversation from '../../models/Conversation.js';
import * as cache from '../../services/cache.service.js';
import { SOCKET_EVENTS, CACHE_KEYS } from '../../common/Constants.js';

const THROTTLE_SECONDS = 2;

// conversationId is the readable id (CVE-XXXXXX) sent by the client; senderId is
// the internal _id used for membership checks and socket-room routing.
const emitToOthers = async (io, conversationId, senderId, event, payload) => {
  const conversation = await Conversation.findOne({ conversationId })
    .select('participants')
    .lean();
  if (!conversation?.participants.some((p) => String(p) === String(senderId))) return;
  conversation.participants
    .map(String)
    .filter((id) => id !== String(senderId))
    .forEach((id) => io.to(id).emit(event, payload));
};

const registerTypingHandlers = (io, socket) => {
  const userId = socket.user.id; // internal _id
  const publicUserId = socket.user.userId; // readable id for payloads

  socket.on(SOCKET_EVENTS.TYPING_START, async ({ conversationId } = {}) => {
    if (!conversationId) return;
    try {
      const acquired = await cache.throttle(
        CACHE_KEYS.typingThrottle(userId, conversationId),
        THROTTLE_SECONDS
      );
      if (!acquired) return;
      await emitToOthers(io, conversationId, userId, SOCKET_EVENTS.TYPING_START, {
        conversationId,
        userId: publicUserId,
      });
    } catch {
      /* typing is best-effort */
    }
  });

  socket.on(SOCKET_EVENTS.TYPING_STOP, async ({ conversationId } = {}) => {
    if (!conversationId) return;
    try {
      await cache.del(CACHE_KEYS.typingThrottle(userId, conversationId));
      await emitToOthers(io, conversationId, userId, SOCKET_EVENTS.TYPING_STOP, {
        conversationId,
        userId: publicUserId,
      });
    } catch {
      /* typing is best-effort */
    }
  });
};

export default registerTypingHandlers;
