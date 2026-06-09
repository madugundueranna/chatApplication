import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { createConversationValidator, conversationIdParam } from '../common/Validators.js';
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
} from '../controllers/conversation.controller.js';

const router = Router();
router.use(authenticate);

router.post('/', createConversationValidator, validate, createConversation);
router.get('/', listConversations);
router.get('/:conversationId', conversationIdParam, validate, getConversation);
router.delete('/:conversationId', conversationIdParam, validate, deleteConversation);

export default router;
