// Types mirror the real backend API response shapes (see backend/API_DOCUMENTATION.md)
// so that swapping the mock lib/api.ts for real fetch calls is a clean change.
// Fields marked "UI-only" are not returned by the backend — they exist only to drive
// this UI (isPinned, isFavourite, bio/phone/location). Keep them optional.

export type ConversationType = "direct" | "group";
export type MessageType = "text" | "image" | "file";

export interface User {
  _id: string;
  name: string;
  email: string;
  avatar: string; // URL or ""
  isOnline: boolean;
  lastSeen: string | null; // ISO
  isVerified?: boolean; // email/OTP confirmed
  isVerifiedAccount?: boolean; // admin-granted "verified" badge
  createdAt?: string;
  // UI-only (contact screen):
  bio?: string;
  phone?: string;
  location?: string;
}

// Metadata stored alongside an image/file message (set by the backend on upload).
export interface MessageAttachment {
  originalName: string;
  mimeType: string;
  size: number;
  caption?: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: string; // userId
  content: string; // text, or media URL for image/file
  type: MessageType;
  readBy: string[]; // userIds
  isDeleted: boolean;
  createdAt: string; // ISO
  updatedAt?: string;
  attachment?: MessageAttachment; // image/file messages only
}

export interface LastMessagePreview {
  _id: string;
  content: string;
  type: MessageType;
  sender: string;
  createdAt: string;
}

export type PublicUser = Pick<User, "_id" | "name" | "avatar" | "isOnline">;

export interface Conversation {
  _id: string;
  type: ConversationType;
  name?: string; // groups only
  participants: string[]; // userIds
  otherParticipants: PublicUser[]; // everyone except me
  lastMessage?: LastMessagePreview | null;
  unreadCount: number;
  updatedAt: string; // ISO
  muted?: boolean; // this user muted notifications (detail endpoint only)
  // UI-only:
  isPinned?: boolean;
  isFavourite?: boolean;
}

// ---- API input shapes (mirror REST request bodies) ----

export interface CreateConversationInput {
  type?: ConversationType; // "direct" (default) | "group"
  participantId?: string; // for direct
  participants?: string[]; // for group
  name?: string; // for group
}

export interface GetMessagesOpts {
  cursor?: string | null;
  limit?: number;
}

// ---- Calls (WebRTC signaling is socket-driven; these mirror the call records) ----

export type CallType = "audio" | "video";
export type CallStatus =
  | "ringing"
  | "ongoing"
  | "answered"
  | "missed"
  | "declined"
  | "ended"
  | "failed";

// The minimal identity the server sends with `call:incoming`.
export interface CallPeer {
  _id: string; // userId
  name: string;
  avatar: string;
}

export interface Call {
  _id: string; // callId
  type: CallType;
  status?: CallStatus;
  caller: CallPeer | null;
  callee: CallPeer | null;
  conversationId?: string | null;
  startedAt?: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSec?: number;
  endReason?: string | null;
  createdAt?: string;
}

// ---- Notifications (in-app center; mirrors the backend Notification model) ----

export type NotificationType =
  | "message"
  | "call_incoming"
  | "call_missed"
  | "group_added"
  | "new_chat";

export interface AppNotification {
  _id: string; // notificationId
  type: NotificationType;
  title: string;
  body: string;
  data: { conversationId?: string; callId?: string; callType?: CallType } & Record<string, any>;
  isRead: boolean;
  sender: PublicUser | null;
  createdAt: string; // ISO
}

// ---- Status / Stories (ephemeral photo/video, auto-expires after 24h) ----

export type StatusMediaType = "image" | "video" | "text";

export interface Status {
  _id: string; // statusId
  type: StatusMediaType;
  mediaUrl: string;
  thumbnailUrl: string; // poster frame for videos (= mediaUrl for images)
  text: string; // text stories
  bgColor: string; // text-story background colour
  caption: string;
  duration: number; // seconds (videos; 0 for images)
  createdAt: string; // ISO
  expiresAt: string; // ISO
  viewed: boolean; // has the current user seen it
  viewersCount?: number; // present only on the owner's own statuses
}

// One author's active statuses (the viewer fetches this for a single user).
export interface StatusUser {
  user: PublicUser; // the author
  isMine: boolean;
  statuses: Status[];
}

// A feed entry (the Stories row): an author group plus seen-state for ordering.
export interface StatusGroup extends StatusUser {
  hasUnseen: boolean;
  lastCreatedAt: string;
}
