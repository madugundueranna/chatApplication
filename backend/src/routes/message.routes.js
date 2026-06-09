import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  sendMessageValidator,
  messageHistoryValidator,
  messageIdParam,
  markManyReadValidator,
} from '../common/Validators.js';
import {
  sendMessage,
  getMessages,
  markRead,
  markManyRead,
  deleteMessage,
} from '../controllers/message.controller.js';

const router = Router();
router.use(authenticate);

router.post('/', sendMessageValidator, validate, sendMessage);
router.post('/:conversationId/read', markManyReadValidator, validate, markManyRead);
router.get('/:conversationId', messageHistoryValidator, validate, getMessages);
router.patch('/:messageId/read', messageIdParam, validate, markRead);
router.delete('/:messageId', messageIdParam, validate, deleteMessage);

export default router;
