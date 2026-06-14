import client from './client';

// --- Stats ---
export const getStats = () => client.get('/admin/stats');

// --- Users ---
// params: { search, filter, sort, page, limit }
export const listUsers = (params) => client.get('/admin/users', { params });
// body: { role?, isVerified?, isActive? }
export const updateUser = (userId, body) =>
  client.patch(`/admin/users/${userId}`, body);
export const deleteUser = (userId) => client.delete(`/admin/users/${userId}`);

// --- Conversations ---
// params: { page, limit }
export const listConversations = (params) =>
  client.get('/admin/conversations', { params });
export const deleteConversation = (conversationId) =>
  client.delete(`/admin/conversations/${conversationId}`);

// --- Messages ---
// params: { conversationId, senderId, page, limit }
export const listMessages = (params) => client.get('/admin/messages', { params });
export const deleteMessage = (messageId) =>
  client.delete(`/admin/messages/${messageId}`);

// --- Reports (user-report moderation queue) ---
// params: { status, page, limit }
export const listReports = (params) => client.get('/admin/reports', { params });
// status: 'open' | 'reviewed' | 'dismissed'
export const updateReport = (reportId, status) =>
  client.patch(`/admin/reports/${reportId}`, { status });
