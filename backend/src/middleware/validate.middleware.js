import { validationResult } from 'express-validator';
import StatusCodes from '../common/StatusCodes.js';
import { sendError } from '../common/Responses.js';

const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  // Return only the offending field names (deduped), not the messages.
  const fields = [...new Set(result.array().map((e) => e.path))];
  return sendError(res, StatusCodes.UNPROCESSABLE_ENTITY, 'Validation failed', fields);
};

export default validate;
