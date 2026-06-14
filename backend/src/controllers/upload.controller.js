import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { processUpload } from '../services/upload.service.js';

// POST /api/uploads — upload-then-send: runs the same verify+stream pipeline as a
// file message and returns just the stored asset, so a client can attach the URL to
// a later message itself. Field name: `file`.
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(StatusCodes.BAD_REQUEST, 'A file is required (field "file")');

  const { url, messageType, attachment } = await processUpload(req.file);
  return sendSuccess(res, StatusCodes.CREATED, 'File uploaded', {
    url,
    type: messageType, // 'image' | 'file'
    mimeType: attachment.mimeType,
    size: attachment.size,
    originalName: attachment.originalName,
  });
});
