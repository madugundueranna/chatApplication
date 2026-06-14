// Admin module — every admin-console route on one router, fully separated from the
// user-facing API. Mounted under /api/admin by the main app. Shared code (models,
// db, utils, constants, the user `authenticate` guard, the `validate` middleware
// and the readable-id param validators) is imported, never duplicated.

import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { userIdParam, conversationIdParam, messageIdParam } from '../common/Validators.js';
import requireAdmin from './admin.middleware.js';
import {
  adminUserListValidator,
  adminUpdateUserValidator,
  adminPaginationValidator,
  adminMessageListValidator,
  adminReportListValidator,
  adminReportUpdateValidator,
  reportIdParam,
} from './admin.validators.js';
import {
  getStats,
  listUsers,
  updateUser,
  deleteUser,
  listConversations,
  deleteConversation,
  listMessages,
  deleteMessage,
  listReports,
  updateReport,
} from './admin.controller.js';

const router = Router();

// The admin module's own auth guard — separate from user auth: a valid token AND
// the admin role (checked against the DB), applied to every route below.
router.use(authenticate, requireAdmin);

// Dashboard
router.get('/stats', getStats);

// Users
router.get('/users', adminUserListValidator, validate, listUsers);
router.patch('/users/:userId', userIdParam, adminUpdateUserValidator, validate, updateUser);
router.delete('/users/:userId', userIdParam, validate, deleteUser);

// Conversations
router.get('/conversations', adminPaginationValidator, validate, listConversations);
router.delete('/conversations/:conversationId', conversationIdParam, validate, deleteConversation);

// Messages (moderation)
router.get('/messages', adminMessageListValidator, validate, listMessages);
router.delete('/messages/:messageId', messageIdParam, validate, deleteMessage);

// Reports (user-report moderation queue)
router.get('/reports', adminReportListValidator, validate, listReports);
router.patch('/reports/:reportId', reportIdParam, adminReportUpdateValidator, validate, updateReport);

export default router;
