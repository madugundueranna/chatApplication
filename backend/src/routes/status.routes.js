import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import upload from '../config/fileUpload.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { userIdParam, statusIdParam, createStatusValidator } from '../common/Validators.js';
import {
  createStatus,
  getStatusFeed,
  getMyStatuses,
  getUserStatuses,
  viewStatus,
  getStatusViewers,
  deleteStatus,
} from '../controllers/status.controller.js';

const router = Router();

// Every status route requires a valid token.
router.use(authenticate);

// Multipart media upload, converting multer / file-filter errors to clean 400s
// (size limit, unsupported type) instead of bubbling up as a 500.
const uploadMedia = (req, res, next) =>
  upload.single('media')(req, res, (err) =>
    err ? next(new ApiError(StatusCodes.BAD_REQUEST, err.message)) : next()
  );

router.post('/', uploadMedia, createStatusValidator, validate, createStatus);
// Feed: `/` is the spec path; `/feed` is kept as an alias the app already uses.
router.get('/', getStatusFeed);
router.get('/feed', getStatusFeed);
router.get('/me', getMyStatuses);
router.get('/user/:userId', userIdParam, validate, getUserStatuses);
router.get('/:statusId/viewers', statusIdParam, validate, getStatusViewers);
router.post('/:statusId/view', statusIdParam, validate, viewStatus);
router.delete('/:statusId', statusIdParam, validate, deleteStatus);

export default router;
