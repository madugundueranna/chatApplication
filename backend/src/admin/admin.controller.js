import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Report from '../models/Report.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { ROLES, CONVERSATION_TYPES, CACHE_KEYS, CACHE_TTL } from '../common/Constants.js';
import * as cache from '../services/cache.service.js';
import redis from '../config/redis.js';
import { parseLimit } from '../utils/pagination.js';
import { invalidateConversationLists } from '../controllers/conversation.controller.js';
import {
  userStatsFacet,
  conversationStatsFacet,
  messageStatsFacet,
  adminConversationsPipeline,
} from './admin.service.js';

// Public, readable-id projections — never leak Mongo's _id.
const USER_ADMIN_FIELDS =
  '-_id userId name email role isActive isVerified isVerifiedAccount isOnline lastSeen createdAt';

// Each `$facet` branch yields `[{ c }]` (or `[]` when empty).
const facetCount = (branch) => (branch && branch[0] ? branch[0].c : 0);
const parsePage = (page) => Math.max(Number(page) || 1, 1);
const meta = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

// GET /api/admin/stats — dashboard metrics in three parallel aggregations
// (one per collection) plus the live online count from Redis presence.
export const getStats = asyncHandler(async (_req, res) => {
  const stats = await cache.remember(CACHE_KEYS.adminStats, CACHE_TTL.ADMIN_STATS, async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6); // today + previous 6 days
    const since = new Date(startOfToday);
    since.setDate(since.getDate() - 29); // 30-day time-series window

    const [[users], [conversations], [messages], onlineNow] = await Promise.all([
      User.aggregate(userStatsFacet(since)),
      Conversation.aggregate(conversationStatsFacet()),
      Message.aggregate(messageStatsFacet({ startOfToday, startOfWeek, since })),
      redis.scard(CACHE_KEYS.onlineUsers),
    ]);

    return {
      users: {
        total: facetCount(users.total),
        verified: facetCount(users.verified),
        admins: facetCount(users.admins),
        onlineNow: Number(onlineNow) || 0,
      },
      conversations: {
        total: facetCount(conversations.total),
        direct: facetCount(conversations.direct),
        group: facetCount(conversations.group),
      },
      messages: {
        total: facetCount(messages.total),
        today: facetCount(messages.today),
        week: facetCount(messages.week),
      },
      // [{ _id: 'YYYY-MM-DD', count }] for the last 30 days.
      timeSeries: {
        signupsPerDay: users.signupsPerDay,
        messagesPerDay: messages.perDay,
      },
    };
  });

  return sendSuccess(res, StatusCodes.OK, 'Stats fetched', stats);
});

// GET /api/admin/users — searchable / filterable / sortable paginated list.
export const listUsers = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { search, filter, sort } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const filters = {
    verified: { isVerified: true },
    unverified: { isVerified: false },
    online: { isOnline: true },
    admin: { role: ROLES.ADMIN },
    user: { role: ROLES.USER },
    active: { isActive: true },
    banned: { isActive: false },
  };
  Object.assign(query, filters[filter] || {});

  const sortSpec =
    sort === 'oldest' ? { createdAt: 1 } : sort === 'name' ? { name: 1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    User.find(query)
      .select(USER_ADMIN_FIELDS)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return sendSuccess(res, StatusCodes.OK, 'Users fetched', { items, ...meta(page, limit, total) });
});

// PATCH /api/admin/users/:userId — verify/unverify, change role, ban/unban.
export const updateUser = asyncHandler(async (req, res) => {
  const target = await User.findOne({ userId: req.params.userId }).select('+refreshTokens');
  if (!target) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  // Guard against an admin locking themselves out of the dashboard.
  const isSelf = target.userId === req.user.userId;
  if (isSelf && (req.body.role === ROLES.USER || req.body.isActive === false))
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot demote or suspend your own account');

  if (req.body.role !== undefined) target.role = req.body.role;
  if (req.body.isVerified !== undefined) target.isVerified = req.body.isVerified;
  // The "verified account" badge — distinct from email verification (`isVerified`).
  if (req.body.isVerifiedAccount !== undefined) target.isVerifiedAccount = req.body.isVerifiedAccount;
  if (req.body.isActive !== undefined) {
    target.isActive = req.body.isActive;
    if (req.body.isActive === false) target.refreshTokens = []; // revoke sessions on ban
  }
  await target.save();

  await cache.del(CACHE_KEYS.userProfile(target._id), CACHE_KEYS.adminStats);
  return sendSuccess(res, StatusCodes.OK, 'User updated', {
    userId: target.userId,
    name: target.name,
    email: target.email,
    role: target.role,
    isActive: target.isActive,
    isVerified: target.isVerified,
    isVerifiedAccount: target.isVerifiedAccount,
  });
});

// DELETE /api/admin/users/:userId — remove the user and clean up their data.
export const deleteUser = asyncHandler(async (req, res) => {
  const target = await User.findOne({ userId: req.params.userId }).select('_id userId').lean();
  if (!target) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  if (target.userId === req.user.userId)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot delete your own account');

  const uid = target.userId; // public id — every reference field stores this
  const convs = await Conversation.find({ participants: uid })
    .select('conversationId participants type')
    .lean();

  const affected = new Set();
  const removedConvs = [];
  for (const c of convs) {
    c.participants.forEach((p) => affected.add(String(p)));
    const remaining = c.participants.filter((p) => String(p) !== uid);
    // Direct chats die with either party; groups die only when they empty out.
    if (c.type === CONVERSATION_TYPES.DIRECT || remaining.length === 0)
      removedConvs.push(c.conversationId);
  }

  // Drop messages in removed conversations and every message this user authored,
  // remove them from any surviving group, then delete the account.
  await Message.deleteMany({ $or: [{ conversation: { $in: removedConvs } }, { sender: uid }] });
  await Conversation.deleteMany({ conversationId: { $in: removedConvs } });
  await Conversation.updateMany({ participants: uid }, { $pull: { participants: uid } });
  await User.deleteOne({ _id: target._id });

  affected.delete(uid);
  await invalidateConversationLists([...affected]);
  await cache.del(CACHE_KEYS.userProfile(target._id), CACHE_KEYS.adminStats);

  return sendSuccess(res, StatusCodes.OK, 'User deleted');
});

// GET /api/admin/conversations — paginated list with participants + counts.
export const listConversations = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);

  const [items, total] = await Promise.all([
    Conversation.aggregate(adminConversationsPipeline({ skip: (page - 1) * limit, limit })),
    Conversation.countDocuments(),
  ]);

  return sendSuccess(res, StatusCodes.OK, 'Conversations fetched', {
    items,
    ...meta(page, limit, total),
  });
});

// DELETE /api/admin/conversations/:conversationId — moderation removal.
export const deleteConversation = asyncHandler(async (req, res) => {
  const conv = await Conversation.findOne({ conversationId: req.params.conversationId })
    .select('conversationId participants')
    .lean();
  if (!conv) throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');

  await Message.deleteMany({ conversation: conv.conversationId });
  await Conversation.deleteOne({ conversationId: conv.conversationId });

  await invalidateConversationLists(conv.participants.map(String));
  await cache.del(CACHE_KEYS.adminStats);
  return sendSuccess(res, StatusCodes.OK, 'Conversation deleted');
});

// GET /api/admin/messages — moderation view, filter by conversation or sender.
export const listMessages = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);

  const query = {};
  // Refs store the readable ids directly, so filter on them (unknown id => no rows).
  if (req.query.conversationId) query.conversation = req.query.conversationId;
  if (req.query.senderId) query.sender = req.query.senderId;

  const [docs, total] = await Promise.all([
    Message.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('senderUser', 'userId name avatar')
      .populate('conversationDoc', 'conversationId type name')
      .lean(),
    Message.countDocuments(query),
  ]);

  // Map to readable shape via the virtual-populated refs.
  const items = docs.map((d) => ({
    messageId: d.messageId,
    content: d.content,
    type: d.type,
    isDeleted: d.isDeleted,
    createdAt: d.createdAt,
    sender: d.senderUser
      ? { userId: d.senderUser.userId, name: d.senderUser.name, avatar: d.senderUser.avatar }
      : null,
    conversation: d.conversationDoc
      ? {
          conversationId: d.conversationDoc.conversationId,
          type: d.conversationDoc.type,
          name: d.conversationDoc.name,
        }
      : null,
  }));

  return sendSuccess(res, StatusCodes.OK, 'Messages fetched', { items, ...meta(page, limit, total) });
});

// DELETE /api/admin/messages/:messageId — soft delete (matches the app convention).
export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findOne({ messageId: req.params.messageId }).select(
    'messageId conversation isDeleted'
  );
  if (!message) throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');

  // updateOne (not save) so the soft-delete bypasses the `content` required-validator.
  await Message.updateOne(
    { messageId: message.messageId },
    { $set: { isDeleted: true, content: '' } }
  );
  await cache.del(CACHE_KEYS.recentMessages(message.conversation), CACHE_KEYS.adminStats);
  return sendSuccess(res, StatusCodes.OK, 'Message deleted');
});

// GET /api/admin/reports — user-report queue, optionally filtered by status.
export const listReports = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);

  const query = {};
  if (req.query.status) query.status = req.query.status;

  const [docs, total] = await Promise.all([
    Report.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reporterUser', 'userId name avatar')
      .populate('reportedUser', 'userId name avatar isVerifiedAccount')
      .lean(),
    Report.countDocuments(query),
  ]);

  const pickUser = (u) =>
    u ? { userId: u.userId, name: u.name, avatar: u.avatar } : null;
  const items = docs.map((d) => ({
    reportId: d.reportId,
    reason: d.reason,
    status: d.status,
    createdAt: d.createdAt,
    reporter: pickUser(d.reporterUser),
    reported: pickUser(d.reportedUser),
  }));

  return sendSuccess(res, StatusCodes.OK, 'Reports fetched', { items, ...meta(page, limit, total) });
});

// PATCH /api/admin/reports/:reportId — set review status (reviewed/dismissed/open).
export const updateReport = asyncHandler(async (req, res) => {
  const report = await Report.findOneAndUpdate(
    { reportId: req.params.reportId },
    { status: req.body.status },
    { new: true }
  );
  if (!report) throw new ApiError(StatusCodes.NOT_FOUND, 'Report not found');
  return sendSuccess(res, StatusCodes.OK, 'Report updated', {
    reportId: report.reportId,
    status: report.status,
  });
});
