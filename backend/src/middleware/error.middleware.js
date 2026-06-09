import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendError } from '../common/Responses.js';

const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Internal server error';

  if (err.name === 'ValidationError') {
    statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  } else if (err.code === 11000) {
    statusCode = StatusCodes.CONFLICT;
    message = 'Resource already exists';
  } else if (err.name === 'CastError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Invalid identifier';
  }

  // Never leak internals on unexpected (non-operational) errors.
  if (!(err instanceof ApiError) && statusCode === StatusCodes.INTERNAL_SERVER_ERROR) {
    message = 'Internal server error';
  }

  sendError(res, statusCode, message);
};

export default errorHandler;
