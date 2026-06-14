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
import { enqueueOtpEmail, enqueuePasswordResetEmail } from '../queues/notification.queue.js';
import createWithRetry from '../utils/createWithRetry.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../utils/authCookies.js';

const publicUser = (user) => ({
  userId: user.userId,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  isVerified: user.isVerified,
  isVerifiedAccount: user.isVerifiedAccount,
  role: user.role,
  isActive: user.isActive,
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

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  // Send a reset code only if the account exists, but always respond the same way
  // so the endpoint never reveals which emails are registered.
  if (user) {
    const otp = generateOtp();
    user.otp = otp;
    await user.save();
    await enqueuePasswordResetEmail(user.email, otp.code);
  }
  return sendSuccess(
    res,
    StatusCodes.OK,
    'If that email is registered, a reset code has been sent.'
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, password } = req.body;
  const user = await User.findOne({ email }).select('+otp +refreshTokens');
  if (!user || !isOtpValid(user.otp, code))
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired code');

  user.password = password; // hashed by the pre-save hook
  user.otp = undefined;
  user.isVerified = true; // proving email ownership also verifies the account
  user.refreshTokens = []; // sign out every existing session
  await user.save();
  return sendSuccess(res, StatusCodes.OK, 'Password reset. You can now sign in.');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user || !(await user.comparePassword(password)))
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
  if (!user.isActive) throw new ApiError(StatusCodes.FORBIDDEN, 'Account suspended');
  if (!user.isVerified) throw new ApiError(StatusCodes.FORBIDDEN, 'Account not verified');

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user._id);
  user.refreshTokens.push(refreshToken);
  await user.save();

  // Web auth rides in HttpOnly cookies; tokens are also returned in the body so
  // non-browser clients (native/Postman) can use the Authorization header.
  setAuthCookies(res, { accessToken, refreshToken });
  return sendSuccess(res, StatusCodes.OK, 'Login successful', {
    accessToken,
    refreshToken,
    user: publicUser(user),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  // Prefer the HttpOnly cookie (web); fall back to the body (native/Postman).
  const refreshToken = req.cookies?.[REFRESH_COOKIE] || req.body.refreshToken;
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
  }

  const user = await User.findById(payload.id).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(refreshToken))
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh token revoked');

  // Rotate: invalidate the used refresh token and issue a fresh pair. A replayed
  // (already-rotated) token fails the includes() check above and is rejected.
  user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
  const newRefreshToken = signRefreshToken(user._id);
  user.refreshTokens.push(newRefreshToken);
  await user.save();

  const accessToken = signAccessToken(user);
  setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });
  return sendSuccess(res, StatusCodes.OK, 'Token refreshed', {
    accessToken,
    refreshToken: newRefreshToken,
  });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] || req.body.refreshToken;
  if (refreshToken) {
    await User.updateOne(
      { refreshTokens: refreshToken },
      { $pull: { refreshTokens: refreshToken } }
    );
  }
  clearAuthCookies(res);
  return sendSuccess(res, StatusCodes.OK, 'Logged out');
});
