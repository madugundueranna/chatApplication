// Multipart upload for chat attachments: a single `file` part held in memory
// (memoryStorage → Buffer, no disk writes) and capped at 10MB. JSON requests pass
// straight through (multer ignores non-multipart bodies), so the text-message path
// on POST /api/messages keeps working unchanged.
//
// The first line of defence is the declared mimetype (fileFilter); the buffer's
// real signature is re-verified later in the upload service before storage.
import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    const err = new Error('Only PDF and image files (jpeg, png, webp, gif) are allowed');
    err.code = 'UNSUPPORTED_FILE_TYPE';
    cb(err);
  },
});

// Map multer's failure modes to the standard envelope with the right status:
//   too large        → 413 "File exceeds 10MB"
//   disallowed type  → 415
//   anything else    → 400
export const uploadMessageFile = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return next(new ApiError(StatusCodes.PAYLOAD_TOO_LARGE, 'File exceeds 10MB'));
      return next(new ApiError(StatusCodes.BAD_REQUEST, err.message));
    }
    if (err.code === 'UNSUPPORTED_FILE_TYPE')
      return next(new ApiError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, err.message));
    return next(new ApiError(StatusCodes.BAD_REQUEST, err.message || 'Upload failed'));
  });
