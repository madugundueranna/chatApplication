import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import upload from '../config/fileUpload.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import {
  updateMeValidator,
  searchValidator,
  userIdParam,
  reportUserValidator,
} from '../common/Validators.js';
import {
  getMe,
  updateMe,
  updateAvatar,
  searchUsers,
  getUserById,
  blockUser,
  unblockUser,
  listBlocked,
  reportUser,
} from '../controllers/user.controller.js';

const router = Router();
router.use(authenticate);

// Multipart avatar upload, converting multer / file-filter errors to clean 400s.
const uploadAvatar = (req, res, next) =>
  upload.single('avatar')(req, res, (err) =>
    err ? next(new ApiError(StatusCodes.BAD_REQUEST, err.message)) : next()
  );

router.get('/me', getMe);
router.patch('/me', updateMeValidator, validate, updateMe);
router.post('/me/avatar', uploadAvatar, updateAvatar);
router.get('/search', searchValidator, validate, searchUsers);

// Block / report — declared before the `/:userId` catch-all so they aren't
// swallowed by the readable-id param route.
router.get('/blocked', listBlocked);
router.post('/block/:userId', userIdParam, validate, blockUser);
router.post('/unblock/:userId', userIdParam, validate, unblockUser);
router.post('/report/:userId', userIdParam, reportUserValidator, validate, reportUser);

router.get('/:userId', userIdParam, validate, getUserById);

export default router;
