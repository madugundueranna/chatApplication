import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { generateOtp, isOtpValid } from '../services/otp.service.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/token.service.js';
import { enqueueOtpEmail } from '../queues/notification.queue.js';
import createWithRetry from '../utils/createWithRetry.js';

const publicUser = (user) => ({
  userId: user.userId,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  isVerified: user.isVerified,
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email }))
    throw new ApiError(StatusCodes.CONFLICT, 'Email already registered');

  const otp = generateOtp();
  const user = await createWithRetry(User, { name, email, password, otp }, 'userId');
  await enqueueOtpEmail(user.email, otp.code);

  return sendSuccess(res, StatusCodes.CREATED, 'Registered. Verify the OTP sent to your email.', {
    userId: user.userId,
  });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email }).select('+otp');
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  if (user.isVerified) return sendSuccess(res, StatusCodes.OK, 'Already verified');
  if (!isOtpValid(user.otp, code))
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired OTP');

  user.isVerified = true;
  user.otp = undefined;
  await user.save();
  return sendSuccess(res, StatusCodes.OK, 'Account verified');
});

export const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  if (user.isVerified) throw new ApiError(StatusCodes.BAD_REQUEST, 'Account already verified');

  const otp = generateOtp();
  user.otp = otp;
  await user.save();
  await enqueueOtpEmail(user.email, otp.code);
  return sendSuccess(res, StatusCodes.OK, 'OTP resent');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user || !(await user.comparePassword(password)))
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
  if (!user.isVerified) throw new ApiError(StatusCodes.FORBIDDEN, 'Account not verified');

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user._id);
  user.refreshTokens.push(refreshToken);
  await user.save();

  return sendSuccess(res, StatusCodes.OK, 'Login successful', {
    accessToken,
    refreshToken,
    user: publicUser(user),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
  }

  const user = await User.findById(payload.id).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(refreshToken))
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh token revoked');

  const accessToken = signAccessToken(user);
  return sendSuccess(res, StatusCodes.OK, 'Token refreshed', { accessToken });
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await User.updateOne(
    { refreshTokens: refreshToken },
    { $pull: { refreshTokens: refreshToken } }
  );
  return sendSuccess(res, StatusCodes.OK, 'Logged out');
});
