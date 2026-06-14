// Single source of truth for the readable-id prefixes. Both the id generators
// (utils/idGenerators.js) and the validators (common/Validators.js) derive from
// this, so the format never drifts between what we mint and what we accept.
export const ID_PREFIXES = {
  USER: 'USR',
  CONVERSATION: 'CVE',
  MESSAGE: 'MSG',
  CALL: 'CAL',
  NOTIFICATION: 'NOT',
  STATUS: 'STA',
  REPORT: 'REP',
};

// User-report review states (admin moderation queue).
export const REPORT_STATUS = { OPEN: 'open', REVIEWED: 'reviewed', DISMISSED: 'dismissed' };

// How long after sending a message its sender may still "delete for everyone".
export const DELETE_FOR_EVERYONE_WINDOW_SECONDS =
  Number(process.env.DELETE_FOR_EVERYONE_WINDOW_SECONDS) || 3600;

// Matches a readable id for a given prefix, e.g. USR-A1B2C3.
export const idPattern = (prefix) => new RegExp(`^${prefix}-[A-Z0-9]{6}$`);

export const ROLES = { USER: 'user', ADMIN: 'admin' };

export const CONVERSATION_TYPES = { DIRECT: 'direct', GROUP: 'group' };

export const MESSAGE_TYPES = { TEXT: 'text', IMAGE: 'image', FILE: 'file' };

// Ephemeral status/story content. Photo, short video, or a text card (bg colour).
export const STATUS_TYPES = { IMAGE: 'image', VIDEO: 'video', TEXT: 'text' };

// How long a posted status stays live before it auto-expires (TTL index).
export const STATUS_TTL_HOURS = 24;

export const CALL_TYPES = { AUDIO: 'audio', VIDEO: 'video' };

// In-app notification categories. Drives the icon/route a client picks per item.
export const NOTIFICATION_TYPES = {
  MESSAGE: 'message',
  CALL_INCOMING: 'call_incoming',
  CALL_MISSED: 'call_missed',
  GROUP_ADDED: 'group_added',
  NEW_CHAT: 'new_chat',
};

// `ongoing` is the live, connected state; `answered` is kept in the enum so call
// records stay forward-compatible with richer call states.
export const CALL_STATUS = {
  RINGING: 'ringing',
  ONGOING: 'ongoing',
  ANSWERED: 'answered',
  MISSED: 'missed',
  DECLINED: 'declined',
  ENDED: 'ended',
  FAILED: 'failed',
};

export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_READ: 'message:read',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  USER_STATUS: 'user:status',
  // --- WebRTC call signaling (media is peer-to-peer; the server only relays) ---
  CALL_INITIATE: 'call:initiate',
  CALL_INCOMING: 'call:incoming',
  CALL_ACCEPT: 'call:accept',
  CALL_ACCEPTED: 'call:accepted',
  CALL_REJECT: 'call:reject',
  CALL_REJECTED: 'call:rejected',
  CALL_OFFER: 'call:offer',
  CALL_ANSWER: 'call:answer',
  CALL_ICE_CANDIDATE: 'call:ice-candidate',
  CALL_ICE_SERVERS: 'call:ice-servers',
  CALL_END: 'call:end',
  CALL_ENDED: 'call:ended',
  CALL_MISSED: 'call:missed',
  CALL_BUSY: 'call:busy',
  CALL_ERROR: 'call:error',
  // --- In-app notifications (server -> client; the bell/center updates live) ---
  NOTIFICATION_NEW: 'notification:new',
  // --- Status/Stories (server -> client) ---
  STORY_NEW: 'story:new', // a contact posted a status
  STORY_VIEWED: 'story:viewed', // someone viewed the owner's status
};

// Cache TTLs in seconds.
export const CACHE_TTL = {
  USER_PROFILE: 300,
  CONVERSATION_LIST: 30,
  RECENT_MESSAGES: 60,
  // Admin dashboard metrics — short TTL so the dashboard stays near-live while
  // collapsing repeated loads into a single set of aggregations.
  ADMIN_STATS: 30,
  // Live call session/busy state — long enough to outlast the longest call,
  // and a safety net so abandoned sessions self-expire.
  CALL_SESSION: 4 * 60 * 60,
};

export const CACHE_KEYS = {
  userProfile: (userId) => `user:profile:${userId}`,
  conversationList: (userId) => `conv:list:${userId}`,
  recentMessages: (conversationId) => `conv:messages:${conversationId}`,
  adminStats: 'admin:stats',
  onlineUsers: 'presence:online',
  userSockets: (userId) => `presence:sockets:${userId}`,
  typingThrottle: (userId, conversationId) => `typing:${userId}:${conversationId}`,
  // Live call routing/state keyed by callId; per-user pointer for busy + disconnect.
  callSession: (callId) => `call:session:${callId}`,
  activeCall: (userId) => `call:active:${userId}`,
  callInitiateThrottle: (userId) => `call:throttle:${userId}`,
  // Account-wide ICE config from the managed TURN provider (shared across users).
  iceServers: 'call:ice:servers',
};
