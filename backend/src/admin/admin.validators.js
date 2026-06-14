import { body, param, query } from 'express-validator';
import { ROLES, REPORT_STATUS, ID_PREFIXES, idPattern } from '../common/Constants.js';

// Readable public ids look like USR-A1B2C3 / CVE-... (prefix + 6 chars); the
// pattern comes from Constants so it never drifts from the id generators.
const readableId = idPattern;

// Page-based pagination, shared across the admin list endpoints.
const pageQuery = () => query('page').optional().isInt({ min: 1 }).toInt();
const limitQuery = () => query('limit').optional().isInt({ min: 1, max: 100 }).toInt();

export const adminUserListValidator = [
  pageQuery(),
  limitQuery(),
  query('search').optional().trim(),
  query('filter')
    .optional()
    .isIn(['all', 'verified', 'unverified', 'online', 'admin', 'user', 'active', 'banned'])
    .withMessage('Invalid filter'),
  query('sort').optional().isIn(['newest', 'oldest', 'name']).withMessage('Invalid sort'),
];

export const adminUpdateUserValidator = [
  body('role').optional().isIn(Object.values(ROLES)).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean').toBoolean(),
  body('isVerified').optional().isBoolean().withMessage('isVerified must be a boolean').toBoolean(),
  body('isVerifiedAccount')
    .optional()
    .isBoolean()
    .withMessage('isVerifiedAccount must be a boolean')
    .toBoolean(),
];

export const adminPaginationValidator = [pageQuery(), limitQuery()];

export const adminMessageListValidator = [
  pageQuery(),
  limitQuery(),
  query('conversationId')
    .optional()
    .matches(readableId(ID_PREFIXES.CONVERSATION))
    .withMessage('A valid conversationId is required'),
  query('senderId').optional().matches(readableId(ID_PREFIXES.USER)).withMessage('A valid senderId is required'),
];

// Reports moderation queue.
export const reportIdParam = [
  param('reportId')
    .matches(readableId(ID_PREFIXES.REPORT))
    .withMessage('A valid report id is required'),
];

export const adminReportListValidator = [
  pageQuery(),
  limitQuery(),
  query('status').optional().isIn(Object.values(REPORT_STATUS)).withMessage('Invalid status'),
];

export const adminReportUpdateValidator = [
  body('status')
    .isIn(Object.values(REPORT_STATUS))
    .withMessage('status must be open, reviewed or dismissed'),
];
