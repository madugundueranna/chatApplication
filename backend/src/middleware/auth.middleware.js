import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { verifyAccessToken } from '../services/token.service.js';
import { ACCESS_COOKIE } from '../utils/authCookies.js';

const authenticate = asyncHandler(async (req, _res, next) => {
  // Prefer the HttpOnly cookie (web); fall back to the Authorization header
  // (native/Postman). Either path yields the same req.user.
  const header = req.headers.authorization || '';
  const token =
    req.cookies?.[ACCESS_COOKIE] || (header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication token missing');

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, userId: payload.userId };
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token');
  }
  next();
});

export default authenticate;
