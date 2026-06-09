import Message from '../../models/Message.js';
import Conversation from '../../models/Conversation.js';
import { createAndDispatchMessage } from '../../controllers/message.controller.js';
import { SOCKET_EVENTS } from '../../common/Constants.js';

const registerMessageHandlers = (io, socket) => {
  const userId = socket.user.id;

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
      const conversation = await Conversation.findById(message.conversation)
        .select('participants conversationId')
        .lean();
      if (!conversation?.participants.some((p) => String(p) === String(userId))) return;

      await Message.updateOne({ _id: message._id }, { $addToSet: { readBy: userId } });
      conversation.participants.forEach((p) =>
        io.to(String(p)).emit(SOCKET_EVENTS.MESSAGE_READ, {
          messageId: message.messageId,
          conversationId: conversation.conversationId,
          userId: socket.user.userId,
        })
      );
    } catch {
      /* ignore — a failed read receipt must not crash the socket */
    }
  });
};

export default registerMessageHandlers;
