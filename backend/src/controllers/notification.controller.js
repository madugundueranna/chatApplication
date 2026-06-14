/**
 * Notification controller
 *
 * Read/manage the caller's in-app notifications (creation happens in
 * notification.service, driven by other actions), plus register/unregister the
 * Expo push tokens used to deliver device pushes.
 *
 *   - listNotifications : the caller's notifications, newest-first, cursor-paged.
 *   - getUnreadCount    : unread badge count for the bell.
 *   - markRead / markAllRead : clear the unread state.
 *   - removeNotification: delete one entry.
 *   - registerPushToken / removePushToken : manage this device's Expo token.
 */
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { serializeNotification, unreadCount } from '../services/notification.service.js';
import { parseLimit, buildCursorFilter, buildPage } from '../utils/pagination.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const docs = await Notification.find({
    recipient: req.user.userId,
    ...buildCursorFilter(req.query.cursor),
  })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('senderUser', 'userId name avatar')
    .lean();

  const { items, nextCursor } = buildPage(docs, limit);
  return sendSuccess(res, StatusCodes.OK, 'Notifications fetched', {
    // senderUser is the virtual-populated sender; serializeNotification expects `sender`.
    items: items.map((n) => serializeNotification({ ...n, sender: n.senderUser })),
    nextCursor,
  });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await unreadCount(req.user.userId);
  return sendSuccess(res, StatusCodes.OK, 'Unread count fetched', { count });
});

export const markRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateOne(
    { notificationId: req.params.notificationId, recipient: req.user.userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  if (result.matchedCount === 0) {
    const exists = await Notification.exists({
      notificationId: req.params.notificationId,
      recipient: req.user.userId,
    });
    if (!exists) throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
  }
  return sendSuccess(res, StatusCodes.OK, 'Notification marked read');
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user.userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return sendSuccess(res, StatusCodes.OK, 'Notifications marked read', {
    modified: result.modifiedCount,
  });
});

export const removeNotification = asyncHandler(async (req, res) => {
  const result = await Notification.deleteOne({
    notificationId: req.params.notificationId,
    recipient: req.user.userId,
  });
  if (result.deletedCount === 0) throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
  return sendSuccess(res, StatusCodes.OK, 'Notification removed');
});

export const registerPushToken = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $addToSet: { pushTokens: req.body.token } });
  return sendSuccess(res, StatusCodes.OK, 'Push token registered');
});

export const removePushToken = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $pull: { pushTokens: req.body.token } });
  return sendSuccess(res, StatusCodes.OK, 'Push token removed');
});
