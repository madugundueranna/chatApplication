import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { SOCKET_EVENTS, CACHE_KEYS, MESSAGE_TYPES } from '../common/Constants.js';
import * as cache from '../services/cache.service.js';
import { getIo } from '../socket/index.js';
import { enqueueNewMessage } from '../queues/notification.queue.js';
import { invalidateConversationLists } from './conversation.controller.js';
import { parseLimit, buildCursorFilter, buildPage } from '../utils/pagination.js';
import createWithRetry from '../utils/createWithRetry.js';

// Load a conversation the user belongs to. `filter` is a Mongo query: REST
// callers pass { conversationId } (readable), internal callers pass { _id }.
const loadParticipantConversation = async (filter, userId) => {
  const conversation = await Conversation.findOne(filter)
    .select('participants type name conversationId')
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

// Map a set of user _ids to their readable userIds.
const buildUserIdMap = async (ids) => {
  const unique = [...new Set(ids.map(String))];
  const users = await User.find({ _id: { $in: unique } })
    .select('userId')
    .lean();
  return new Map(users.map((u) => [String(u._id), u.userId]));
};

// Public, readable-id shape used for both the REST response and socket emit.
const serializeMessage = (msg, conversationId, userIdMap) => ({
  messageId: msg.messageId,
  conversationId,
  sender: userIdMap.get(String(msg.sender)),
  content: msg.content,
  type: msg.type,
  readBy: (msg.readBy || []).map((id) => userIdMap.get(String(id))).filter(Boolean),
  isDeleted: msg.isDeleted ?? false,
  createdAt: msg.createdAt,
});

// Shared by REST `POST /messages` and the socket `message:send` handler.
// `conversationId` is the readable id (CVE-XXXXXX).
export const createAndDispatchMessage = async ({ conversationId, senderId, content, type }) => {
  const conversation = await loadParticipantConversation({ conversationId }, senderId);

  const message = await createWithRetry(
    Message,
    {
      conversation: conversation._id,
      sender: senderId,
      content,
      type: type || MESSAGE_TYPES.TEXT,
      readBy: [senderId],
    },
    'messageId'
  );
  await Conversation.updateOne({ _id: conversation._id }, { lastMessage: message._id });

  const participantIds = conversation.participants.map(String);
  await invalidateConversationLists(participantIds);
  await cache.del(CACHE_KEYS.recentMessages(conversation._id));

  const sender = await User.findById(senderId).select('userId name').lean();
  const payload = serializeMessage(
    message,
    conversation.conversationId,
    new Map([[String(senderId), sender?.userId]])
  );

  const others = participantIds.filter((id) => id !== String(senderId));
  emitToUsers(others, SOCKET_EVENTS.MESSAGE_NEW, payload);

  const offline = await cache.filterOffline(others);
  if (offline.length) {
    const recipients = await User.find({ _id: { $in: offline } }).select('email').lean();
    await enqueueNewMessage({
      recipients: recipients.map((u) => u.email),
      senderName: sender?.name || 'Someone',
    });
  }

  return payload;
};

export const sendMessage = asyncHandler(async (req, res) => {
  const message = await createAndDispatchMessage({
    conversationId: req.body.conversationId,
    senderId: req.user.id,
    content: req.body.content,
    type: req.body.type,
  });
  return sendSuccess(res, StatusCodes.CREATED, 'Message sent', message);
});

export const getMessages = asyncHandler(async (req, res) => {
  const conversation = await loadParticipantConversation(
    { conversationId: req.params.conversationId },
    req.user.id
  );
  const limit = parseLimit(req.query.limit);
  const docs = await Message.find({
    conversation: conversation._id,
    isDeleted: false,
    ...buildCursorFilter(req.query.cursor),
  })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const { items, nextCursor } = buildPage(docs, limit);
  const userIdMap = await buildUserIdMap(items.flatMap((m) => [m.sender, ...(m.readBy || [])]));
  const serialized = items.map((m) =>
    serializeMessage(m, conversation.conversationId, userIdMap)
  );
  return sendSuccess(res, StatusCodes.OK, 'Messages fetched', { items: serialized, nextCursor });
});

export const markRead = asyncHandler(async (req, res) => {
  const message = await Message.findOne({ messageId: req.params.messageId }).select(
    'conversation messageId'
  );
  if (!message) throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');
  const conversation = await loadParticipantConversation({ _id: message.conversation }, req.user.id);

  await Message.updateOne({ _id: message._id }, { $addToSet: { readBy: req.user.id } });
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
    req.user.id
  );
  const result = await Message.updateMany(
    {
      conversation: conversation._id,
      sender: { $ne: req.user.id },
      readBy: { $ne: req.user.id },
    },
    { $addToSet: { readBy: req.user.id } }
  );
  await cache.del(CACHE_KEYS.conversationList(req.user.id));
  return sendSuccess(res, StatusCodes.OK, 'Messages marked read', {
    modified: result.modifiedCount,
  });
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findOne({ messageId: req.params.messageId });
  if (!message) throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');
  if (String(message.sender) !== String(req.user.id))
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the sender can delete this message');

  message.isDeleted = true;
  message.content = '';
  await message.save();
  return sendSuccess(res, StatusCodes.OK, 'Message deleted');
});
