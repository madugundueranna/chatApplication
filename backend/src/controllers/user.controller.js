import User from '../models/User.js';
import Report from '../models/Report.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { CACHE_KEYS, CACHE_TTL } from '../common/Constants.js';
import * as cache from '../services/cache.service.js';
import { userSearchPipeline } from '../common/Aggregations.js';
import { areBlocked, blockedRelationSet } from '../services/block.service.js';
import { uploadMedia } from '../services/cloudinary.service.js';
import createWithRetry from '../utils/createWithRetry.js';

// Leading `-_id` excludes Mongo's internal id; the readable userId is the public one.
const PROFILE_FIELDS =
  '-_id userId name email avatar role isActive isOnline lastSeen isVerified isVerifiedAccount createdAt';

export const getMe = asyncHandler(async (req, res) => {
  const user = await cache.remember(
    CACHE_KEYS.userProfile(req.user.id),
    CACHE_TTL.USER_PROFILE,
    () => User.findById(req.user.id).select(PROFILE_FIELDS).lean()
  );
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  return sendSuccess(res, StatusCodes.OK, 'Profile fetched', user);
});

export const updateMe = asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.avatar !== undefined) updates.avatar = req.body.avatar;

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true,
  })
    .select(PROFILE_FIELDS)
    .lean();
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  await cache.del(CACHE_KEYS.userProfile(req.user.id));
  return sendSuccess(res, StatusCodes.OK, 'Profile updated', user);
});

// POST /api/users/me/avatar — upload a profile photo (multipart `avatar`) to
// Cloudinary and store its URL. Returns the same profile shape as updateMe.
export const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(StatusCodes.BAD_REQUEST, 'An image file is required');
  if (!req.file.mimetype.startsWith('image/'))
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only image files are allowed');

  const result = await uploadMedia(req.file.buffer, {
    resourceType: 'image',
    folder: 'chatloop/avatars',
  });

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { avatar: result.secure_url },
    { new: true, runValidators: true }
  )
    .select(PROFILE_FIELDS)
    .lean();
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  await cache.del(CACHE_KEYS.userProfile(req.user.id));
  return sendSuccess(res, StatusCodes.OK, 'Avatar updated', user);
});

export const searchUsers = asyncHandler(async (req, res) => {
  const users = await User.aggregate(userSearchPipeline(req.query.q, req.user.userId, 20));
  // Hide online status for anyone in a block relationship with the requester.
  const blocked = await blockedRelationSet(
    req.user.userId,
    users.map((u) => u.userId)
  );
  const safe = users.map((u) => (blocked.has(u.userId) ? { ...u, isOnline: false } : u));
  return sendSuccess(res, StatusCodes.OK, 'Search results', safe);
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findOne({ userId: req.params.userId })
    .select('-_id userId name avatar isOnline lastSeen isVerifiedAccount')
    .lean();
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  // Blocked either way: hide presence/last-seen from each other.
  if (await areBlocked(req.user.userId, req.params.userId)) {
    user.isOnline = false;
    user.lastSeen = null;
  }
  return sendSuccess(res, StatusCodes.OK, 'User fetched', user);
});

// ---- Block / unblock ----

export const blockUser = asyncHandler(async (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user.userId)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot block yourself');
  if (!(await User.exists({ userId: targetId })))
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  await User.updateOne({ _id: req.user.id }, { $addToSet: { blockedUsers: targetId } });
  return sendSuccess(res, StatusCodes.OK, 'User blocked', { userId: targetId, blocked: true });
});

export const unblockUser = asyncHandler(async (req, res) => {
  const targetId = req.params.userId;
  await User.updateOne({ _id: req.user.id }, { $pull: { blockedUsers: targetId } });
  return sendSuccess(res, StatusCodes.OK, 'User unblocked', { userId: targetId, blocked: false });
});

export const listBlocked = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user.id).select('blockedUsers').lean();
  const ids = me?.blockedUsers || [];
  const users = ids.length
    ? await User.find({ userId: { $in: ids } })
        .select('-_id userId name avatar')
        .lean()
    : [];
  return sendSuccess(res, StatusCodes.OK, 'Blocked users fetched', users);
});

// ---- Report a user ----

export const reportUser = asyncHandler(async (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user.userId)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot report yourself');
  if (!(await User.exists({ userId: targetId })))
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  const report = await createWithRetry(
    Report,
    { reporter: req.user.userId, reported: targetId, reason: req.body.reason },
    'reportId'
  );
  return sendSuccess(res, StatusCodes.CREATED, 'Report submitted', { reportId: report.reportId });
});
