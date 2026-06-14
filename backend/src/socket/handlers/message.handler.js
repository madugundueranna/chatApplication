import Message from '../../models/Message.js';
import Conversation from '../../models/Conversation.js';
import { createAndDispatchMessage } from '../../controllers/message.controller.js';
import { SOCKET_EVENTS } from '../../common/Constants.js';

const registerMessageHandlers = (io, socket) => {
  const userId = socket.user.userId; // public id: refs, membership checks, socket rooms

  socket.on(SOCKET_EVENTS.MESSAGE_SEND, async (data, ack) => {
    try {
      const message = await createAndDispatchMessage({
        conversationId: data?.conversationId,
        senderId: userId,
        content: data?.content,
        type: data?.type,
      });
      if (typeof ack === 'function') ack({ success: true, message });
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message });
    }
  });

  socket.on(SOCKET_EVENTS.MESSAGE_READ, async (data) => {
    try {
      const message = await Message.findOne({ messageId: data?.messageId }).select(
        'conversation messageId'
      );
      if (!message) return;
      // message.conversation is now the readable conversationId (CVE-XXXXXX).
      const conversation = await Conversation.findOne({ conversationId: message.conversation })
        .select('participants conversationId')
        .lean();
      if (!conversation?.participants.some((p) => p === userId)) return;

      await Message.updateOne({ messageId: message.messageId }, { $addToSet: { readBy: userId } });
      conversation.participants.forEach((p) =>
        io.to(p).emit(SOCKET_EVENTS.MESSAGE_READ, {
          messageId: message.messageId,
          conversationId: conversation.conversationId,
          userId,
        })
      );
    } catch {
      /* ignore — a failed read receipt must not crash the socket */
    }
  });
};

export default registerMessageHandlers;
