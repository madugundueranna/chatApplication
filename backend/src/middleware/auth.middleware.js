import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { verifyAccessToken } from '../services/token.service.js';

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
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
