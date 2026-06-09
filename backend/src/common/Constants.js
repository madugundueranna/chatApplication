export const ROLES = { USER: 'user' };

export const CONVERSATION_TYPES = { DIRECT: 'direct', GROUP: 'group' };

export const MESSAGE_TYPES = { TEXT: 'text', IMAGE: 'image', FILE: 'file' };

export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_READ: 'message:read',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  USER_STATUS: 'user:status',
};

// Cache TTLs in seconds.
export const CACHE_TTL = {
  USER_PROFILE: 300,
  CONVERSATION_LIST: 30,
  RECENT_MESSAGES: 60,
};

export const CACHE_KEYS = {
  userProfile: (userId) => `user:profile:${userId}`,
  conversationList: (userId) => `conv:list:${userId}`,
  recentMessages: (conversationId) => `conv:messages:${conversationId}`,
  onlineUsers: 'presence:online',
  userSockets: (userId) => `presence:sockets:${userId}`,
  typingThrottle: (userId, conversationId) => `typing:${userId}:${conversationId}`,
};
