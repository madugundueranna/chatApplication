import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  notificationIdParam,
  notificationHistoryValidator,
  pushTokenValidator,
} from '../common/Validators.js';
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  removeNotification,
  registerPushToken,
  removePushToken,
} from '../controllers/notification.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', notificationHistoryValidator, validate, listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:notificationId/read', notificationIdParam, validate, markRead);
router.delete('/:notificationId', notificationIdParam, validate, removeNotification);

// Expo device push tokens (registered on login, removed on logout/uninstall).
router.post('/push-tokens', pushTokenValidator, validate, registerPushToken);
router.delete('/push-tokens', pushTokenValidator, validate, removePushToken);

export default router;
