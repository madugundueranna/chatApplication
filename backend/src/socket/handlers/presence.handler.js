import User from '../../models/User.js';
import * as cache from '../../services/cache.service.js';
import { SOCKET_EVENTS } from '../../common/Constants.js';

const registerPresenceHandlers = (io, socket) => {
  const userId = socket.user.id; // internal _id: socket room + db writes
  const publicUserId = socket.user.userId; // readable id: broadcast payloads

  const goOnline = async () => {
    try {
      socket.join(userId);
      await cache.addOnline(userId, socket.id);
      await User.updateOne({ _id: userId }, { isOnline: true });
      socket.broadcast.emit(SOCKET_EVENTS.USER_STATUS, { userId: publicUserId, isOnline: true });
    } catch {
      /* presence is best-effort */
    }
  };

  socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
    try {
      const remaining = await cache.removeOnline(userId, socket.id);
      if (remaining > 0) return;
      const lastSeen = new Date();
      await User.updateOne({ _id: userId }, { isOnline: false, lastSeen });
      socket.broadcast.emit(SOCKET_EVENTS.USER_STATUS, {
        userId: publicUserId,
        isOnline: false,
        lastSeen,
      });
    } catch {
      /* presence is best-effort */
    }
  });

  goOnline();
};

export default registerPresenceHandlers;
