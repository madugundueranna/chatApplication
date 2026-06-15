import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import {
  SOCKET_EVENTS,
  CACHE_KEYS,
  MESSAGE_TYPES,
  CONVERSATION_TYPES,
  NOTIFICATION_TYPES,
  DELETE_FOR_EVERYONE_WINDOW_SECONDS,
} from '../common/Constants.js';
import * as cache from '../services/cache.service.js';
import { getIo } from '../socket/index.js';
import { notify } from '../services/notification.service.js';
import { areBlocked } from '../services/block.service.js';
import { invalidateConversationLists } from './conversation.controller.js';
import { processUpload } from '../services/upload.service.js';
import { parseLimit, buildCursorFilter, buildPage } from '../utils/pagination.js';
import createWithRetry from '../utils/createWithRetry.js';

// Load a conversation the user belongs to. `filter` is a Mongo query; callers
// pass { conversationId } (the readable id used for refs). `userId` is the
// caller's public userId.
const loadParticipantConversation = async (filter, userId) => {
  const conversation = await Conversation.findOne(filter)
    .select('participants type name conversationId participantStates')
    .lean();
  if (!conversation) throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
  const isMember = conversation.participants.some((p) => String(p) === String(userId));
  if (!isMember) throw new ApiError(StatusCodes.FORBIDDEN, 'Not a conversation participant');
  return conversation;
};

const emitToUsers = (userIds, event, payload) => {
  const io = getIo();
  userIds.forEach((id) => io.to(String(id)).emit(event, payload));
};

// Public, readable-id shape. sender/readBy already hold public userIds.
const serializeMessage = (msg, conversationId) => ({
  messageId: msg.messageId,
  conversationId,
  sender: msg.sender,
  content: msg.content,
  type: msg.type,
  readBy: msg.readBy || [],
  isDeleted: msg.isDeleted ?? false,
  createdAt: msg.createdAt,
  // Attachment metadata for image/file messages (absent on text messages).
  ...(msg.attachment
    ? {
        attachment: {
          originalName: msg.attachment.originalName,
          mimeType: msg.attachment.mimeType,
          size: msg.attachment.size,
          ...(msg.attachment.caption ? { caption: msg.attachment.caption } : {}),
        },
      }
    : {}),
});

// Short text preview for a notification body (media carries no readable content).
// In groups we prefix the sender since the title is the group name.
const messagePreview = (msg, senderName, conversationType) => {
  const label =
    msg.type === MESSAGE_TYPES.IMAGE
      ? '📷 Photo'
      : msg.type === MESSAGE_TYPES.FILE
        ? '📎 File'
        : (msg.content || '').slice(0, 140);
  return conversationType === CONVERSATION_TYPES.GROUP ? `${senderName}: ${label}` : label;
};

// Shared by REST `POST /messages` and the socket `message:send` handler.
// `conversationId` is the readable id (CVE-XXXXXX); `senderId` is the public userId.
export const createAndDispatchMessage = async ({
  conversationId,
  senderId,
  content,
  type,
  attachment,
}) => {
  const conversation = await loadParticipantConversation({ conversationId }, senderId);

  // Direct-chat block check: refuse if either party has blocked the other.
  if (conversation.type === CONVERSATION_TYPES.DIRECT) {
    const otherId = conversation.participants.find((p) => p !== senderId);
    if (otherId && (await areBlocked(senderId, otherId)))
      throw new ApiError(StatusCodes.FORBIDDEN, 'You cannot message this user');
  }

  const message = await createWithRetry(
    Message,
    {
      conversation: conversation.conversationId,
      sender: senderId,
      content,
      type: type || MESSAGE_TYPES.TEXT,
      readBy: [senderId],
      ...(attachment ? { attachment } : {}),
    },
    'messageId'
  );
  await Conversation.updateOne(
    { conversationId: conversation.conversationId },
    { lastMessage: message.messageId }
  );

  const participantIds = conversation.participants.map(String);
  await invalidateConversationLists(participantIds);
  await cache.del(CACHE_KEYS.recentMessages(conversation.conversationId));

  const sender = await User.findOne({ userId: senderId }).select('userId name avatar').lean();
  const payload = serializeMessage(message, conversation.conversationId);

  const others = participantIds.filter((id) => id !== String(senderId));
  emitToUsers(others, SOCKET_EVENTS.MESSAGE_NEW, payload);

  // Notify away recipients: online users already have the live message + chat
  // list, so a bell entry + push is only worth it for those currently offline.
  const offline = await cache.filterOffline(others);
  // Respect per-user mute: muted participants get no push/bell for this chat
  // (the live message still reaches an open chat above).
  const mutedSet = new Set(
    (conversation.participantStates || []).filter((s) => s.muted).map((s) => s.userId)
  );
  const notifiable = offline.filter((id) => !mutedSet.has(id));
  if (notifiable.length) {
    const senderName = sender?.name || 'Someone';
    const title =
      conversation.type === CONVERSATION_TYPES.GROUP && conversation.name
        ? conversation.name
        : senderName;
    const senderInfo = { userId: senderId, name: senderName, avatar: sender?.avatar };
    await Promise.allSettled(
      notifiable.map((recipientId) =>
        notify({
          recipientId,
          type: NOTIFICATION_TYPES.MESSAGE,
          title,
          body: messagePreview(message, senderName, conversation.type),
          data: { conversationId: conversation.conversationId },
          sender: senderInfo,
        })
      )
    );
  }

  return payload;
};

export const sendMessage = asyncHandler(async (req, res) => {
  // Multipart file path: verify the buffer's real type, stream it to storage, then
  // dispatch as an image/file message with the SAME side effects as a text message.
  if (req.file) {
    const { url, messageType, attachment } = await processUpload(req.file);
    if (req.body.caption?.trim()) attachment.caption = req.body.caption.trim();
    const fileMessage = await createAndDispatchMessage({
      conversationId: req.body.conversationId,
      senderId: req.user.userId,
      content: url, // the stored secure URL
      type: messageType, // 'image' | 'file'
      attachment,
    });
    return sendSuccess(res, StatusCodes.CREATED, 'File sent', fileMessage);
  }

  // Text path (unchanged).
  const message = await createAndDispatchMessage({
    conversationId: req.body.conversationId,
    senderId: req.user.userId,
    content: req.body.content,
    type: req.body.type,
  });
  return sendSuccess(res, StatusCodes.CREATED, 'Message sent', message);
});

export const getMessages = asyncHandler(async (req, res) => {
  const conversation = await loadParticipantConversation(
    { conversationId: req.params.conversationId },
    req.user.userId
  );
  // "Clear chat" cutoff for this user (hides older history for them only).
  const myState = (conversation.participantStates || []).find(
    (s) => s.userId === req.user.userId
  );
  const limit = parseLimit(req.query.limit);
  const docs = await Message.find({
    conversation: conversation.conversationId,
    isDeleted: false,
    deletedFor: { $ne: req.user.userId }, // "delete for me" hides it for this user
    ...(myState?.clearedAt ? { createdAt: { $gt: myState.clearedAt } } : {}),
    ...buildCursorFilter(req.query.cursor),
  })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const { items, nextCursor } = buildPage(docs, limit);
  const serialized = items.map((m) => serializeMessage(m, conversation.conversationId));
  return sendSuccess(res, StatusCodes.OK, 'Messages fetched', { items: serialized, nextCursor });
});

export const markRead = asyncHandler(async (req, res) => {
  const message = await Message.findOne({ messageId: req.params.messageId }).select(
    'conversation messageId'
  );
  if (!message) throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');
  // message.conversation is the readable conversationId now.
  const conversation = await loadParticipantConversation(
    { conversationId: message.conversation },
    req.user.userId
  );

  await Message.updateOne({ messageId: message.messageId }, { $addToSet: { readBy: req.user.userId } });
  emitToUsers(conversation.participants, SOCKET_EVENTS.MESSAGE_READ, {
    messageId: message.messageId,
    conversationId: conversation.conversationId,
    userId: req.user.userId,
  });
  return sendSuccess(res, StatusCodes.OK, 'Message marked read');
});

export const markManyRead = asyncHandler(async (req, res) => {
  const conversation = await loadParticipantConversation(
    { conversationId: req.params.conversationId },
    req.user.userId
  );
  const result = await Message.updateMany(
    {
      conversation: conversation.conversationId,
      sender: { $ne: req.user.userId },
      readBy: { $ne: req.user.userId },
    },
    { $addToSet: { readBy: req.user.userId } }
  );
  await cache.del(CACHE_KEYS.conversationList(req.user.userId));
  return sendSuccess(res, StatusCodes.OK, 'Messages marked read', {
    modified: result.modifiedCount,
  });
});

// DELETE /messages/:messageId?scope=me|everyone
//   me       — hide for the requester only (any participant).
//   everyone — soft-delete for all (sender only, within the allowed time window).
export const deleteMessage = asyncHandler(async (req, res) => {
  const scope = req.query.scope === 'me' ? 'me' : 'everyone';
  const message = await Message.findOne({ messageId: req.params.messageId });
  if (!message) throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');

  // Both scopes require the requester to belong to the conversation.
  const conversation = await Conversation.findOne({ conversationId: message.conversation })
    .select('participants')
    .lean();
  if (!conversation?.participants.some((p) => p === req.user.userId))
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not a conversation participant');

  if (scope === 'me') {
    await Message.updateOne(
      { messageId: message.messageId },
      { $addToSet: { deletedFor: req.user.userId } }
    );
    return sendSuccess(res, StatusCodes.OK, 'Message deleted for you');
  }

  // scope === 'everyone': sender only, and only within the allowed window.
  if (message.sender !== req.user.userId)
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the sender can delete for everyone');
  const ageSeconds = (Date.now() - new Date(message.createdAt).getTime()) / 1000;
  if (ageSeconds > DELETE_FOR_EVERYONE_WINDOW_SECONDS)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Too late to delete this message for everyone');

  // updateOne (not save) so the soft-delete bypasses the `content` required-validator.
  await Message.updateOne(
    { messageId: message.messageId },
    { $set: { isDeleted: true, content: '' } }
  );
  await invalidateConversationLists(conversation.participants.map(String));
  return sendSuccess(res, StatusCodes.OK, 'Message deleted for everyone');
});
