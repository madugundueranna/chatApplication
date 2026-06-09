import { body, param, query } from 'express-validator';
import { CONVERSATION_TYPES, MESSAGE_TYPES } from './Constants.js';

const email = () => body('email').isEmail().withMessage('A valid email is required').normalizeEmail();
const password = () =>
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters');

// Readable public ids look like USR-A1B2C3 / CvE-... / MSG-... (prefix + 6 chars).
const readableId = (prefix) => new RegExp(`^${prefix}-[A-Z0-9]{6}$`);
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

export const refreshValidator = [
  body('refreshToken').notEmpty().withMessage('refreshToken is required'),
];

export const logoutValidator = [
  body('refreshToken').notEmpty().withMessage('refreshToken is required'),
];

export const updateMeValidator = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('avatar').optional().isString().withMessage('avatar must be a string'),
];

export const searchValidator = [
  query('q').trim().notEmpty().withMessage('Search query is required'),
];

export const userIdParam = [readableParam('userId', 'USR', 'user id')];

export const createConversationValidator = [
  body('type').optional().isIn(Object.values(CONVERSATION_TYPES)),
  readableBody('participantId', 'USR', 'participantId').optional(),
  body('participants').optional().isArray({ min: 1 }).withMessage('participants must be a non-empty array'),
  body('participants.*').optional().matches(readableId('USR')).withMessage('Each participant must be a valid user id'),
  body('name').optional().trim().notEmpty().withMessage('Group name cannot be empty'),
];

export const conversationIdParam = [readableParam('conversationId', 'CvE', 'conversation id')];

export const sendMessageValidator = [
  readableBody('conversationId', 'CvE', 'conversationId'),
  body('content').trim().notEmpty().withMessage('Message content is required'),
  body('type').optional().isIn(Object.values(MESSAGE_TYPES)),
];

export const messageHistoryValidator = [
  readableParam('conversationId', 'CvE', 'conversationId'),
  query('cursor').optional().isMongoId().withMessage('cursor must be a valid id'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const messageIdParam = [readableParam('messageId', 'MSG', 'message id')];

export const markManyReadValidator = [readableParam('conversationId', 'CvE', 'conversationId')];
