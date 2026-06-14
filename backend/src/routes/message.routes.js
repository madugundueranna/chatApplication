import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { uploadMessageFile } from '../middleware/messageUpload.middleware.js';
import {
  sendMessageValidator,
  messageHistoryValidator,
  messageIdParam,
  markManyReadValidator,
  deleteMessageValidator,
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

// Accepts EITHER application/json (text message) OR multipart/form-data with a
// `file` part (image/PDF). `uploadMessageFile` is a no-op for JSON requests, so the
// text path is unchanged; for multipart it parses the file into req.file (Buffer).
router.post('/', uploadMessageFile, sendMessageValidator, validate, sendMessage);
router.post('/:conversationId/read', markManyReadValidator, validate, markManyRead);
router.get('/:conversationId', messageHistoryValidator, validate, getMessages);
router.patch('/:messageId/read', messageIdParam, validate, markRead);
router.delete('/:messageId', deleteMessageValidator, validate, deleteMessage);

export default router;
