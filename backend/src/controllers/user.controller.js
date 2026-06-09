import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { CACHE_KEYS, CACHE_TTL } from '../common/Constants.js';
import * as cache from '../services/cache.service.js';
import { userSearchPipeline } from '../common/Aggregations.js';

// Leading `-_id` excludes Mongo's internal id; the readable userId is the public one.
const PROFILE_FIELDS = '-_id userId name email avatar isOnline lastSeen isVerified createdAt';

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

export const searchUsers = asyncHandler(async (req, res) => {
  const users = await User.aggregate(userSearchPipeline(req.query.q, req.user.id, 20));
  return sendSuccess(res, StatusCodes.OK, 'Search results', users);
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findOne({ userId: req.params.userId })
    .select('-_id userId name avatar isOnline lastSeen')
    .lean();
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  return sendSuccess(res, StatusCodes.OK, 'User fetched', user);
});
