export const sendSuccess = (res, statusCode, message, data = null) =>
  res.status(statusCode).json({ success: true, message, data });

export const sendError = (res, statusCode, message, data = null) =>
  res.status(statusCode).json({ success: false, message, data });
