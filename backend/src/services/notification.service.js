/**
 * Notification service
 *
 * The single entry point for in-app notifications. `notify` does three things for
 * one recipient:
 *   1. persists a Notification (so it shows in the bell/center on next fetch),
 *   2. emits `notification:new` to the recipient's socket room with the fresh
 *      unread count (the bell updates live for online users), and
 *   3. enqueues an Expo device push when the recipient is offline (mirrors the
 *      existing email-to-offline behaviour — push is most useful when away).
 *
 * Every step is best-effort and isolated: a notification must never break the
 * action that triggered it (sending a message, starting a call, etc.), so callers
 * should treat failures as non-fatal.
 */
import Notification from '../models/Notification.js';
import * as cache from './cache.service.js';
import { getIo } from '../socket/index.js';
import { SOCKET_EVENTS } from '../common/Constants.js';
import { enqueuePushNotification } from '../queues/notification.queue.js';
import createWithRetry from '../utils/createWithRetry.js';

// Public, readable-id shape used for both the REST list and the socket emit.
// `sender` is null or a populated/plain object carrying { userId, name, avatar }.
export const serializeNotification = (n) => ({
  notificationId: n.notificationId,
  type: n.type,
  title: n.title,
  body: n.body ?? '',
  data: n.data || {},
  isRead: Boolean(n.isRead),
  sender: n.sender
    ? { userId: n.sender.userId, name: n.sender.name, avatar: n.sender.avatar ?? '' }
    : null,
  createdAt: n.createdAt,
});

export const unreadCount = (recipientId) =>
  Notification.countDocuments({ recipient: recipientId, isRead: false });

/**
 * Create + dispatch one notification.
 *
 * @param {string} recipientId  public userId (USR-) to notify
 * @param {string} type         NOTIFICATION_TYPES value
 * @param {string} title
 * @param {string} body
 * @param {object} data         routing payload (e.g. { conversationId, callId })
 * @param {object|null} sender  { id?, userId, name, avatar } — userId is stored, the
 *                              rest decorate the payload (avoids a populate query)
 */
export const notify = async ({ recipientId, type, title, body = '', data = {}, sender = null }) => {
  const recipient = String(recipientId);
  const doc = await createWithRetry(
    Notification,
    { recipient, type, title, body, data, sender: sender?.userId },
    'notificationId'
  );

  const payload = serializeNotification({
    notificationId: doc.notificationId,
    type,
    title,
    body,
    data,
    isRead: false,
    sender: sender ? { userId: sender.userId, name: sender.name, avatar: sender.avatar } : null,
    createdAt: doc.createdAt,
  });

  try {
    const count = await unreadCount(recipient);
    getIo().to(recipient).emit(SOCKET_EVENTS.NOTIFICATION_NEW, { notification: payload, unreadCount: count });
  } catch {
    /* socket not ready / recipient offline — the persisted notification still surfaces on fetch */
  }

  if (!(await cache.isOnline(recipient))) {
    await enqueuePushNotification({
      userId: recipient,
      title,
      body,
      data: { ...data, type, notificationId: doc.notificationId },
    });
  }

  return payload;
};

// Push to a user's devices without persisting an in-app entry — for transient
// events (e.g. a ringing incoming call) that have no place in the bell/center.
export const pushToUser = (userId, { title, body, data = {} }) =>
  enqueuePushNotification({ userId: String(userId), title, body, data });
