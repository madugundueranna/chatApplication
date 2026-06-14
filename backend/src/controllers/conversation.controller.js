/**
 * Conversation controller
 *
 * Handles the lifecycle of direct (1:1) and group conversations:
 *   - createConversation : start a direct chat (deduped — returns the existing
 *                          one if it already exists) or create a named group.
 *   - listConversations  : return the caller's conversations, served from cache.
 *   - getConversation    : fetch one conversation by id (participants only).
 *   - deleteConversation  : leave a group (or delete it once empty), or delete a
 *                          direct conversation outright.
 *
 * Cross-model references are stored as public ids (participants/createdBy hold
 * USR-/the readable conversationId), so all access checks and persistence use the
 * caller's public userId. References serialize to the readable response shape via
 * the schema's virtual-populate fields.
 */
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { CONVERSATION_TYPES, CACHE_KEYS, CACHE_TTL, NOTIFICATION_TYPES } from '../common/Constants.js';
import * as cache from '../services/cache.service.js';
import { notify } from '../services/notification.service.js';
import { areBlocked } from '../services/block.service.js';
import { conversationListPipeline } from '../common/Aggregations.js';
import createWithRetry from '../utils/createWithRetry.js';

// Public sender ref for notifications: { userId, name, avatar }.
const senderRef = async (userId) => {
  const u = await User.findOne({ userId }).select('userId name avatar').lean();
  return { userId, name: u?.name || 'Someone', avatar: u?.avatar };
};

// Drop the cached conversation list for every affected participant (keyed by userId).
export const invalidateConversationLists = (participantIds) =>
  cache.del(...participantIds.map((id) => CACHE_KEYS.conversationList(String(id))));

const ensureParticipant = (conversation, userId) => {
  const isMember = conversation.participants.some((p) => String(p) === String(userId));
  if (!isMember) throw new ApiError(StatusCodes.FORBIDDEN, 'Not a conversation participant');
};

// Virtual-populate the string references so we can serialize readable fields.
const populateConversation = (query) =>
  query
    .populate('participantUsers', 'userId name avatar isOnline lastSeen')
    .populate('creator', 'userId')
    .populate({
      path: 'lastMessageDoc',
      select: 'messageId content type createdAt sender',
      populate: { path: 'senderUser', select: 'userId name' },
    });

// Build the readable response shape from a virtual-populated conversation doc.
// `viewerId` (optional) surfaces that user's private `muted` flag.
const serializeConversation = (c, viewerId) =>
  c && {
    conversationId: c.conversationId,
    type: c.type,
    name: c.name,
    participants: (c.participantUsers || []).map((u) => ({
      userId: u.userId,
      name: u.name,
      avatar: u.avatar,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen,
    })),
    createdBy: c.creator?.userId ?? c.createdBy ?? null,
    lastMessage: c.lastMessageDoc
      ? {
          messageId: c.lastMessageDoc.messageId,
          content: c.lastMessageDoc.content,
          type: c.lastMessageDoc.type,
          createdAt: c.lastMessageDoc.createdAt,
          sender: c.lastMessageDoc.senderUser?.userId ?? c.lastMessageDoc.sender ?? null,
        }
      : null,
    muted:
      (c.participantStates || []).find((s) => String(s.userId) === String(viewerId))?.muted ??
      false,
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
  };

// References store the userId directly, so we only need to confirm it exists.
const assertUserExists = async (userId) => {
  const exists = await User.exists({ userId });
  if (!exists) throw new ApiError(StatusCodes.NOT_FOUND, `User ${userId} not found`);
  return userId;
};

export const createConversation = asyncHandler(async (req, res) => {
  const me = req.user.userId;
  const { type = CONVERSATION_TYPES.DIRECT, participantId, participants, name } = req.body;

  if (type === CONVERSATION_TYPES.DIRECT) {
    if (!participantId) throw new ApiError(StatusCodes.BAD_REQUEST, 'participantId is required');
    const otherId = await assertUserExists(participantId);
    if (otherId === me)
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot start a conversation with yourself');
    if (await areBlocked(me, otherId))
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'You cannot start a conversation with this user'
      );

    const existing = await populateConversation(
      Conversation.findOne({
        type: CONVERSATION_TYPES.DIRECT,
        participants: { $all: [me, otherId], $size: 2 },
      })
    );
    if (existing)
      return sendSuccess(res, StatusCodes.OK, 'Conversation fetched', serializeConversation(existing, me));

    const created = await createWithRetry(
      Conversation,
      { type: CONVERSATION_TYPES.DIRECT, participants: [me, otherId], createdBy: me },
      'conversationId'
    );
    await invalidateConversationLists([me, otherId]);

    // No live signal otherwise tells the other user a chat now exists — notify them.
    const sender = await senderRef(me);
    await notify({
      recipientId: otherId,
      type: NOTIFICATION_TYPES.NEW_CHAT,
      title: sender.name,
      body: `${sender.name} started a chat with you`,
      data: { conversationId: created.conversationId },
      sender,
    }).catch(() => {});

    const populated = await populateConversation(
      Conversation.findOne({ conversationId: created.conversationId })
    );
    return sendSuccess(res, StatusCodes.CREATED, 'Conversation created', serializeConversation(populated, me));
  }

  if (!name) throw new ApiError(StatusCodes.BAD_REQUEST, 'Group name is required');
  if (!Array.isArray(participants) || participants.length === 0)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Participants are required');

  // Validate every readable userId; reject the whole request if any is unknown.
  const found = await User.find({ userId: { $in: participants } })
    .select('userId')
    .lean();
  if (found.length !== new Set(participants).size) {
    const known = new Set(found.map((u) => u.userId));
    const missing = participants.filter((id) => !known.has(id));
    throw new ApiError(StatusCodes.NOT_FOUND, `Unknown user(s): ${missing.join(', ')}`);
  }

  const members = [...new Set([me, ...found.map((u) => u.userId)])];
  const created = await createWithRetry(
    Conversation,
    { type: CONVERSATION_TYPES.GROUP, participants: members, name, createdBy: me },
    'conversationId'
  );
  await invalidateConversationLists(members);

  // Tell every added member (not the creator) they're in a new group.
  const sender = await senderRef(me);
  await Promise.allSettled(
    members
      .filter((id) => id !== me)
      .map((recipientId) =>
        notify({
          recipientId,
          type: NOTIFICATION_TYPES.GROUP_ADDED,
          title: name,
          body: `${sender.name} added you to "${name}"`,
          data: { conversationId: created.conversationId },
          sender,
        })
      )
  );

  const populated = await populateConversation(
    Conversation.findOne({ conversationId: created.conversationId })
  );
  return sendSuccess(res, StatusCodes.CREATED, 'Group created', serializeConversation(populated, me));
});

export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await cache.remember(
    CACHE_KEYS.conversationList(req.user.userId),
    CACHE_TTL.CONVERSATION_LIST,
    () => Conversation.aggregate(conversationListPipeline(req.user.userId))
  );
  return sendSuccess(res, StatusCodes.OK, 'Conversations fetched', conversations);
});

export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await populateConversation(
    Conversation.findOne({ conversationId: req.params.conversationId })
  );
  if (!conversation) throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
  ensureParticipant(conversation, req.user.userId);
  return sendSuccess(res, StatusCodes.OK, 'Conversation fetched', serializeConversation(conversation, req.user.userId));
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({ conversationId: req.params.conversationId });
  if (!conversation) throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
  ensureParticipant(conversation, req.user.userId);

  const participantIds = conversation.participants.map(String);
  if (conversation.type === CONVERSATION_TYPES.GROUP) {
    conversation.participants = conversation.participants.filter(
      (p) => String(p) !== String(req.user.userId)
    );
    if (conversation.participants.length === 0) await conversation.deleteOne();
    else await conversation.save();
  } else {
    await conversation.deleteOne();
  }

  await invalidateConversationLists(participantIds);
  return sendSuccess(res, StatusCodes.OK, 'Conversation removed');
});

// ---- Per-user conversation state (clear chat, mute) ----

// Confirm membership, then upsert this user's participantStates entry with `patch`.
const setParticipantState = async (conversationId, userId, patch) => {
  const conversation = await Conversation.findOne({ conversationId })
    .select('participants conversationId')
    .lean();
  if (!conversation) throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
  if (!conversation.participants.some((p) => String(p) === String(userId)))
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not a conversation participant');

  // Update the existing entry, or push a new one if this user has no state yet.
  const setFields = Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [`participantStates.$.${k}`, v])
  );
  const updated = await Conversation.updateOne(
    { conversationId, 'participantStates.userId': userId },
    { $set: setFields }
  );
  if (updated.matchedCount === 0) {
    await Conversation.updateOne(
      { conversationId },
      { $push: { participantStates: { userId, ...patch } } }
    );
  }
};

// POST /conversations/:conversationId/clear — hide existing history for me only.
export const clearConversation = asyncHandler(async (req, res) => {
  await setParticipantState(req.params.conversationId, req.user.userId, {
    clearedAt: new Date(),
  });
  await cache.del(CACHE_KEYS.conversationList(req.user.userId));
  return sendSuccess(res, StatusCodes.OK, 'Conversation cleared');
});

// POST /conversations/:conversationId/mute
export const muteConversation = asyncHandler(async (req, res) => {
  await setParticipantState(req.params.conversationId, req.user.userId, { muted: true });
  // Refresh the cached list so the muted bell shows immediately.
  await cache.del(CACHE_KEYS.conversationList(req.user.userId));
  return sendSuccess(res, StatusCodes.OK, 'Conversation muted', { muted: true });
});

// POST /conversations/:conversationId/unmute
export const unmuteConversation = asyncHandler(async (req, res) => {
  await setParticipantState(req.params.conversationId, req.user.userId, { muted: false });
  await cache.del(CACHE_KEYS.conversationList(req.user.userId));
  return sendSuccess(res, StatusCodes.OK, 'Conversation unmuted', { muted: false });
});
