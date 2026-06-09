import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { CONVERSATION_TYPES, CACHE_KEYS, CACHE_TTL } from '../common/Constants.js';
import * as cache from '../services/cache.service.js';
import { conversationListPipeline } from '../common/Aggregations.js';
import createWithRetry from '../utils/createWithRetry.js';

// Drop the cached conversation list for every affected participant.
export const invalidateConversationLists = (participantIds) =>
  cache.del(...participantIds.map((id) => CACHE_KEYS.conversationList(String(id))));

const ensureParticipant = (conversation, userId) => {
  const isMember = conversation.participants.some(
    (p) => String(p._id ?? p) === String(userId)
  );
  if (!isMember) throw new ApiError(StatusCodes.FORBIDDEN, 'Not a conversation participant');
};

// Populate a conversation so its references serialize as readable ids (the
// schema toJSON transforms strip _id from each populated subdocument).
const populateConversation = (query) =>
  query
    .populate('participants', 'userId name avatar isOnline lastSeen')
    .populate('createdBy', 'userId')
    .populate({
      path: 'lastMessage',
      select: 'messageId content type createdAt sender',
      populate: { path: 'sender', select: 'userId name' },
    });

// Resolve a single readable userId to its internal _id, or 404.
const resolveUserId = async (userId) => {
  const user = await User.findOne({ userId }).select('_id').lean();
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, `User ${userId} not found`);
  return user._id;
};

export const createConversation = asyncHandler(async (req, res) => {
  const me = req.user.id;
  const { type = CONVERSATION_TYPES.DIRECT, participantId, participants, name } = req.body;

  if (type === CONVERSATION_TYPES.DIRECT) {
    if (!participantId) throw new ApiError(StatusCodes.BAD_REQUEST, 'participantId is required');
    const otherId = await resolveUserId(participantId);
    if (String(otherId) === String(me))
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot start a conversation with yourself');

    const existing = await populateConversation(
      Conversation.findOne({
        type: CONVERSATION_TYPES.DIRECT,
        participants: { $all: [me, otherId], $size: 2 },
      })
    );
    if (existing) return sendSuccess(res, StatusCodes.OK, 'Conversation fetched', existing);

    const created = await createWithRetry(
      Conversation,
      {
        type: CONVERSATION_TYPES.DIRECT,
        participants: [me, otherId],
        createdBy: me,
      },
      'conversationId'
    );
    await invalidateConversationLists([me, otherId]);
    const populated = await populateConversation(Conversation.findById(created._id));
    return sendSuccess(res, StatusCodes.CREATED, 'Conversation created', populated);
  }

  if (!name) throw new ApiError(StatusCodes.BAD_REQUEST, 'Group name is required');
  if (!Array.isArray(participants) || participants.length === 0)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Participants are required');

  // Resolve every readable userId; reject the whole request if any is unknown.
  const found = await User.find({ userId: { $in: participants } })
    .select('_id userId')
    .lean();
  if (found.length !== new Set(participants).size) {
    const known = new Set(found.map((u) => u.userId));
    const missing = participants.filter((id) => !known.has(id));
    throw new ApiError(StatusCodes.NOT_FOUND, `Unknown user(s): ${missing.join(', ')}`);
  }

  const members = [...new Set([String(me), ...found.map((u) => String(u._id))])];
  const created = await createWithRetry(
    Conversation,
    {
      type: CONVERSATION_TYPES.GROUP,
      participants: members,
      name,
      createdBy: me,
    },
    'conversationId'
  );
  await invalidateConversationLists(members);
  const populated = await populateConversation(Conversation.findById(created._id));
  return sendSuccess(res, StatusCodes.CREATED, 'Group created', populated);
});

export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await cache.remember(
    CACHE_KEYS.conversationList(req.user.id),
    CACHE_TTL.CONVERSATION_LIST,
    () => Conversation.aggregate(conversationListPipeline(req.user.id))
  );
  return sendSuccess(res, StatusCodes.OK, 'Conversations fetched', conversations);
});

export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await populateConversation(
    Conversation.findOne({ conversationId: req.params.conversationId })
  );
  if (!conversation) throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
  ensureParticipant(conversation, req.user.id);
  return sendSuccess(res, StatusCodes.OK, 'Conversation fetched', conversation);
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({ conversationId: req.params.conversationId });
  if (!conversation) throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
  ensureParticipant(conversation, req.user.id);

  const participantIds = conversation.participants.map(String);
  if (conversation.type === CONVERSATION_TYPES.GROUP) {
    conversation.participants = conversation.participants.filter(
      (p) => String(p) !== String(req.user.id)
    );
    if (conversation.participants.length === 0) await conversation.deleteOne();
    else await conversation.save();
  } else {
    await conversation.deleteOne();
  }

  await invalidateConversationLists(participantIds);
  return sendSuccess(res, StatusCodes.OK, 'Conversation removed');
});
