import { body, param, query } from 'express-validator';
import { CONVERSATION_TYPES, MESSAGE_TYPES, ID_PREFIXES, idPattern } from './Constants.js';

const email = () => body('email').isEmail().withMessage('A valid email is required').normalizeEmail();
const password = () =>
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters');

// Readable public ids look like USR-A1B2C3 / CVE-... / MSG-... (prefix + 6 chars).
// Pattern + prefixes both come from Constants so they never drift from the generators.
const readableId = idPattern;
const readableParam = (name, prefix, label) =>
  param(name).matches(readableId(prefix)).withMessage(`A valid ${label} is required`);
const readableBody = (name, prefix, label) =>
  body(name).matches(readableId(prefix)).withMessage(`A valid ${label} is required`);

export const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  email(),
  password(),
];

export const loginValidator = [
  email(),
  body('password').notEmpty().withMessage('Password is required'),
];

export const verifyOtpValidator = [
  email(),
  body('code').trim().isLength({ min: 4, max: 8 }).withMessage('A valid OTP code is required'),
];

export const resendOtpValidator = [email()];

export const forgotPasswordValidator = [email()];

export const resetPasswordValidator = [
  email(),
  body('code').trim().isLength({ min: 4, max: 8 }).withMessage('A valid code is required'),
  password(),
];

// refreshToken may arrive in the HttpOnly cookie instead of the body, so it's
// optional here; the controller reads cookie-or-body and 401s if neither is valid.
export const refreshValidator = [
  body('refreshToken').optional().isString().withMessage('refreshToken must be a string'),
];

export const logoutValidator = [
  body('refreshToken').optional().isString().withMessage('refreshToken must be a string'),
];

export const updateMeValidator = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('avatar').optional().isString().withMessage('avatar must be a string'),
];

export const searchValidator = [
  query('q').trim().notEmpty().withMessage('Search query is required'),
];

export const userIdParam = [readableParam('userId', ID_PREFIXES.USER, 'user id')];

// Report a user — the target is the :userId path param; reason is required.
export const reportUserValidator = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('A reason is required')
    .isLength({ max: 500 })
    .withMessage('Reason must be 500 characters or fewer'),
];

export const createConversationValidator = [
  body('type').optional().isIn(Object.values(CONVERSATION_TYPES)),
  readableBody('participantId', ID_PREFIXES.USER, 'participantId').optional(),
  body('participants').optional().isArray({ min: 1 }).withMessage('participants must be a non-empty array'),
  body('participants.*').optional().matches(readableId(ID_PREFIXES.USER)).withMessage('Each participant must be a valid user id'),
  body('name').optional().trim().notEmpty().withMessage('Group name cannot be empty'),
];

export const conversationIdParam = [readableParam('conversationId', ID_PREFIXES.CONVERSATION, 'conversation id')];

export const sendMessageValidator = [
  readableBody('conversationId', ID_PREFIXES.CONVERSATION, 'conversationId'),
  // Text messages require content. A file message (multipart `file` part) may omit
  // it — the file is the payload, and any text becomes an optional caption.
  body('content')
    .if((_value, { req }) => !req.file)
    .trim()
    .notEmpty()
    .withMessage('Message content is required'),
  body('caption').optional().isString().trim().isLength({ max: 1000 }).withMessage('Caption is too long'),
  body('type').optional().isIn(Object.values(MESSAGE_TYPES)),
];

export const messageHistoryValidator = [
  readableParam('conversationId', ID_PREFIXES.CONVERSATION, 'conversationId'),
  query('cursor').optional().isMongoId().withMessage('cursor must be a valid id'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const messageIdParam = [readableParam('messageId', ID_PREFIXES.MESSAGE, 'message id')];

// Delete a message: ?scope=me (hide for me) or everyone (sender, within window).
export const deleteMessageValidator = [
  readableParam('messageId', ID_PREFIXES.MESSAGE, 'message id'),
  query('scope')
    .optional()
    .isIn(['me', 'everyone'])
    .withMessage("scope must be 'me' or 'everyone'"),
];

export const markManyReadValidator = [readableParam('conversationId', ID_PREFIXES.CONVERSATION, 'conversationId')];

export const callIdParam = [readableParam('callId', ID_PREFIXES.CALL, 'call id')];

export const callHistoryValidator = [
  query('cursor').optional().isMongoId().withMessage('cursor must be a valid id'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const notificationIdParam = [readableParam('notificationId', ID_PREFIXES.NOTIFICATION, 'notification id')];

export const notificationHistoryValidator = [
  query('cursor').optional().isMongoId().withMessage('cursor must be a valid id'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

// Expo push tokens look like `ExponentPushToken[xxxx]` / `ExpoPushToken[xxxx]`.
export const pushTokenValidator = [
  body('token')
    .matches(/^Expo(nent)?PushToken\[[^\]]+\]$/)
    .withMessage('A valid Expo push token is required'),
];

export const statusIdParam = [readableParam('statusId', ID_PREFIXES.STATUS, 'status id')];

// Media is validated by multer (type/size). Text stories carry { text, bgColor }
// in the body; the controller enforces "media OR text required".
export const createStatusValidator = [
  body('caption').optional().isString().trim().isLength({ max: 200 }).withMessage('Caption is too long'),
  body('text').optional().isString().trim().isLength({ max: 280 }).withMessage('Text is too long'),
  body('bgColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('bgColor must be a hex colour like #2563EB'),
];
