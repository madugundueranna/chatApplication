// Shared attachment pipeline: verify the buffer's REAL type (magic bytes), then
// stream it to Cloudinary. Used by both the file-message path (POST /api/messages)
// and the standalone POST /api/uploads.
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { MESSAGE_TYPES } from '../common/Constants.js';
import { uploadMedia } from './cloudinary.service.js';
import { detectMimeFromBuffer, normalizeMime } from '../utils/fileSignature.js';

const ALLOWED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// Takes a multer file ({ buffer, originalname, mimetype, size }). Verifies the real
// signature, rejects spoofed/disallowed content, streams to storage, and returns
// { url, messageType, attachment: { originalName, mimeType, size } }.
export const processUpload = async (file) => {
  if (!file?.buffer?.length) throw new ApiError(StatusCodes.BAD_REQUEST, 'Empty or missing file');

  // Re-verify the true type from the bytes — don't trust the declared mimetype.
  const detected = detectMimeFromBuffer(file.buffer);
  if (!detected || !ALLOWED.has(detected))
    throw new ApiError(
      StatusCodes.UNSUPPORTED_MEDIA_TYPE,
      'Unsupported file type — only PDF and images (jpeg, png, webp, gif) are allowed'
    );

  // The declared type must match the real signature, or it's a spoof.
  if (normalizeMime(file.mimetype) !== detected)
    throw new ApiError(
      StatusCodes.UNSUPPORTED_MEDIA_TYPE,
      'File contents do not match its declared type'
    );

  const isPdf = detected === 'application/pdf';
  // Images → "image"; PDFs (and other docs) → "raw" so Cloudinary serves them as-is.
  const result = await uploadMedia(file.buffer, {
    resourceType: isPdf ? 'raw' : 'image',
    folder: 'chatloop/messages',
  });

  return {
    url: result.secure_url,
    messageType: isPdf ? MESSAGE_TYPES.FILE : MESSAGE_TYPES.IMAGE,
    attachment: {
      originalName: file.originalname,
      mimeType: detected,
      size: file.size,
    },
  };
};
