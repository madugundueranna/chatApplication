import { validationResult } from 'express-validator';
import StatusCodes from '../common/StatusCodes.js';
import { sendError } from '../common/Responses.js';

const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  // Return the first readable message per field as { field, message } (deduped),
  // so clients can show errors inline. Matches the documented 422 shape.
  const seen = new Set();
  const errors = [];
  for (const e of result.array()) {
    if (seen.has(e.path)) continue;
    seen.add(e.path);
    errors.push({ field: e.path, message: e.msg });
  }
  return sendError(res, StatusCodes.UNPROCESSABLE_ENTITY, 'Validation failed', errors);
};

export default validate;
