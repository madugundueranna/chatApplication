import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { ROLES } from '../common/Constants.js';
import User from '../models/User.js';

// The admin module's role guard. Runs AFTER the shared `authenticate`: the access
// token does not carry the role, so we read it (and isActive) from the DB on every
// admin request — this is the security boundary for /api/admin/*, kept separate
// from user auth so a regular or suspended user can never get through.
const requireAdmin = asyncHandler(async (req, _res, next) => {
  const user = await User.findById(req.user.id).select('role isActive').lean();
  if (!user || user.role !== ROLES.ADMIN || user.isActive === false)
    throw new ApiError(StatusCodes.FORBIDDEN, 'Admin access required');

  req.user.role = user.role;
  next();
});

export default requireAdmin;
