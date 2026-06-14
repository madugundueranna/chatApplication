import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { createConversationValidator, conversationIdParam } from '../common/Validators.js';
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  clearConversation,
  muteConversation,
  unmuteConversation,
} from '../controllers/conversation.controller.js';

const router = Router();
router.use(authenticate);

router.post('/', createConversationValidator, validate, createConversation);
router.get('/', listConversations);
router.get('/:conversationId', conversationIdParam, validate, getConversation);
router.delete('/:conversationId', conversationIdParam, validate, deleteConversation);

// Per-user conversation actions (WhatsApp-style).
router.post('/:conversationId/clear', conversationIdParam, validate, clearConversation);
router.post('/:conversationId/mute', conversationIdParam, validate, muteConversation);
router.post('/:conversationId/unmute', conversationIdParam, validate, unmuteConversation);

export default router;
