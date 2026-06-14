// Readable-id -> `_id` normalizers.
//
// The backend hides Mongo `_id` and exposes readable prefixed ids
// (userId=USR-…, conversationId=CVE-…, messageId=MSG-…, callId=CAL-…). The whole
// existing UI is built around an `_id` field, so we normalize here — in ONE place
// reused by both REST responses and socket payloads — and the screens/types stay
// unchanged. `sender`/`readBy`/participant ids are already readable userIds, so a
// message's `sender` lines up with the logged-in user's `_id` (their userId).

import {
  AppNotification,
  Call,
  Conversation,
  LastMessagePreview,
  Message,
  PublicUser,
  Status,
  StatusGroup,
  StatusUser,
  User,
} from "../types";
import { getCurrentUserId } from "../session";

// Raw shapes are loosely typed — the backend is the source of truth, and we only
// read the fields we map.
type Raw = Record<string, any>;

export function mapUser(raw: Raw): User {
  return {
    _id: raw.userId,
    name: raw.name,
    email: raw.email ?? "",
    avatar: raw.avatar ?? "",
    isOnline: Boolean(raw.isOnline),
    lastSeen: raw.lastSeen ?? null,
    isVerified: raw.isVerified,
    isVerifiedAccount: Boolean(raw.isVerifiedAccount),
    createdAt: raw.createdAt,
  };
}

export function mapPublicUser(raw: Raw): PublicUser {
  return {
    _id: raw.userId,
    name: raw.name,
    avatar: raw.avatar ?? "",
    isOnline: Boolean(raw.isOnline),
  };
}

export function mapMessage(raw: Raw): Message {
  return {
    _id: raw.messageId,
    conversation: raw.conversationId,
    sender: raw.sender, // already a readable userId
    content: raw.content ?? "",
    type: raw.type ?? "text",
    readBy: Array.isArray(raw.readBy) ? raw.readBy : [],
    isDeleted: raw.isDeleted ?? false,
    createdAt: raw.createdAt,
    updatedAt: raw.createdAt, // backend doesn't return updatedAt on messages
    attachment: raw.attachment, // present on image/file messages
  };
}

function mapLastMessage(raw: Raw | null | undefined): LastMessagePreview | null {
  if (!raw) return null;
  return {
    _id: raw.messageId,
    content: raw.content ?? "",
    type: raw.type ?? "text",
    // list endpoint sends sender as a userId string; detail nests { userId, name }.
    sender: typeof raw.sender === "string" ? raw.sender : raw.sender?.userId,
    createdAt: raw.createdAt,
  };
}

// `GET /api/conversations` (aggregation): has otherParticipants + unreadCount.
export function mapConversationListItem(raw: Raw): Conversation {
  const others: PublicUser[] = (raw.otherParticipants ?? []).map(mapPublicUser);
  const me = getCurrentUserId();
  return {
    _id: raw.conversationId,
    type: raw.type,
    name: raw.name,
    participants: [...(me ? [me] : []), ...others.map((u) => u._id)],
    otherParticipants: others,
    lastMessage: mapLastMessage(raw.lastMessage),
    unreadCount: raw.unreadCount ?? 0,
    muted: Boolean(raw.muted),
    updatedAt: raw.updatedAt,
  };
}

// `GET /api/conversations/:id` / `POST /api/conversations` (populated doc): has the
// full participants list but no otherParticipants/unreadCount — derive them.
export function mapConversationDetail(raw: Raw): Conversation {
  const me = getCurrentUserId();
  const participants: PublicUser[] = (raw.participants ?? []).map(mapPublicUser);
  return {
    _id: raw.conversationId,
    type: raw.type,
    name: raw.name,
    participants: participants.map((u) => u._id),
    otherParticipants: participants.filter((u) => u._id !== me),
    lastMessage: mapLastMessage(raw.lastMessage),
    unreadCount: raw.unreadCount ?? 0,
    muted: Boolean(raw.muted),
    updatedAt: raw.updatedAt,
  };
}

function mapCallPeer(raw: Raw | null | undefined) {
  if (!raw) return null;
  return { _id: raw.userId, name: raw.name, avatar: raw.avatar ?? "" };
}

// Notifications arrive both from REST and the `notification:new` socket payload.
export function mapNotification(raw: Raw): AppNotification {
  return {
    _id: raw.notificationId,
    type: raw.type,
    title: raw.title ?? "",
    body: raw.body ?? "",
    data: raw.data ?? {},
    isRead: Boolean(raw.isRead),
    sender: raw.sender
      ? mapPublicUser({ ...raw.sender, isOnline: false })
      : null,
    createdAt: raw.createdAt,
  };
}

export function mapStatus(raw: Raw): Status {
  const type: Status["type"] =
    raw.type === "video" ? "video" : raw.type === "text" ? "text" : "image";
  return {
    _id: raw.statusId,
    type,
    mediaUrl: raw.mediaUrl ?? "",
    thumbnailUrl: raw.thumbnailUrl || raw.mediaUrl || "",
    text: raw.text ?? "",
    bgColor: raw.bgColor || "#2563EB",
    caption: raw.caption ?? "",
    duration: raw.duration ?? 0,
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt,
    viewed: Boolean(raw.viewed),
    viewersCount: raw.viewersCount,
  };
}

// `GET /api/status/user/:id` — one author's active statuses (for the viewer).
export function mapStatusUser(raw: Raw): StatusUser {
  return {
    user: mapPublicUser(raw.user ?? {}),
    isMine: Boolean(raw.isMine),
    statuses: (raw.statuses ?? []).map(mapStatus),
  };
}

// `GET /api/status/feed` — the Stories row: author groups with seen-state.
export function mapStatusGroup(raw: Raw): StatusGroup {
  return {
    ...mapStatusUser(raw),
    hasUnseen: Boolean(raw.hasUnseen),
    lastCreatedAt: raw.lastCreatedAt,
  };
}

export function mapCall(raw: Raw): Call {
  return {
    _id: raw.callId,
    type: raw.type,
    status: raw.status,
    caller: mapCallPeer(raw.caller),
    callee: mapCallPeer(raw.callee),
    conversationId: raw.conversationId ?? null,
    startedAt: raw.startedAt,
    answeredAt: raw.answeredAt ?? null,
    endedAt: raw.endedAt ?? null,
    durationSec: raw.durationSec,
    endReason: raw.endReason ?? null,
    createdAt: raw.createdAt,
  };
}
