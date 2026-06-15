# Chat Application — API Documentation

Real-time chat backend built with **Express + MongoDB (Mongoose) + Redis (ioredis) +
Socket.io + BullMQ + Cloudinary** (ES Modules). This document is the source of truth for the
REST API and the Socket.io real-time contract.

---

## 1. Project Overview

| Item | Value |
|------|-------|
| Name | `chat-backend` |
| Purpose | Real-time 1:1 & group chat with auth, presence, typing, read receipts, calls (WebRTC signaling), ephemeral status/stories, notifications and moderation |
| Runtime | Node.js ≥ 20 (ES Modules) |
| Transport | REST (HTTP/JSON) + Socket.io (WebSocket) |
| Persistence | MongoDB (Mongoose) |
| Cache / presence / pub-sub / live call state | Redis (ioredis) |
| Background jobs | BullMQ (`notifications` queue + worker: email + Expo push) |
| Media | Cloudinary (avatars, status media, image/file messages) |
| Auth | JWT access + refresh; `bcrypt` hashing; email OTP verification |

**Resources:** User, Conversation (`direct`/`group`), Message, Call, Notification, Status
(story), Report.

---

## 2. Readable IDs (IMPORTANT)

The API **never exposes Mongo `_id`**. Every document has a public, human-readable prefixed id,
and **all cross-document references are stored and returned as these id strings** (not ObjectIds):

| Resource | Prefix | Example |
|----------|--------|---------|
| User | `USR-` | `USR-A1B2C3` |
| Conversation | `CVE-` | `CVE-A1B2C3` |
| Message | `MSG-` | `MSG-A1B2C3` |
| Call | `CAL-` | `CAL-A1B2C3` |
| Notification | `NOT-` | `NOT-A1B2C3` |
| Status | `STA-` | `STA-A1B2C3` |
| Report | `REP-` | `REP-A1B2C3` |

Format: `PREFIX-[A-Z0-9]{6}`. So a message's `sender` is a `USR-…`, its `conversation` is a
`CVE-…`, a conversation's `participants` is an array of `USR-…`, etc. Path params and body refs
are validated against this format (invalid → `422`).

> Cursor pagination (`GET /messages`, `/calls`, `/notifications`) uses an **opaque Mongo
> ObjectId hex** as the `nextCursor`/`cursor` value — the one place a raw id surfaces. Pass it
> back verbatim.

---

## 3. Base URL

| | |
|--|--|
| Local | `http://localhost:5000` |
| API prefix | `/api` |
| Health | `GET /health` |
| Socket.io | connects to the **root** origin (`http://localhost:5000`), not under `/api` |

The API is **unversioned** (routes mounted directly under `/api`).

---

## 4. Authentication Flow

JWT-based, with email OTP verification before first login.

```
register ─▶ (OTP emailed) ─▶ verify-otp ─▶ login ─▶ { accessToken, refreshToken }
                                 ▲                        │ access expires (15m)
                            resend-otp                    ▼
                                                      refresh ─▶ new accessToken
                                                          │
                                                       logout ─▶ refreshToken revoked
```

| Token | Lifetime (default) | Sent as | Config |
|-------|--------------------|---------|--------|
| Access | `15m` | `Authorization: Bearer <token>` header (native) **or** HttpOnly cookie (web) | `JWT_ACCESS_EXPIRES` |
| Refresh | `7d` | JSON body `{ refreshToken }` **or** HttpOnly cookie | `JWT_REFRESH_EXPIRES` |

- Login is rejected (`403`) until the account is verified, and (`403`) if the account is banned (`isActive:false`).
- Each login appends a refresh token to the user (multi-device). Banning / `reset-password` revokes all.
- **Socket.io auth:** native passes the token in the handshake (`io(URL,{auth:{token}})`); web uses the cookie. Invalid/missing → `connect_error`.

---

## 5. Response Envelope

Every JSON response uses one envelope:

```json
{ "success": true, "message": "Human-readable summary", "data": {} }
```

- `success` — `true` for 2xx, `false` for errors.
- `data` — payload on success; `null` on most errors; an **array of field errors** on `422`.

---

## 6. Error Handling

| Status | When |
|--------|------|
| `400` | Business-rule violation (e.g. self-conversation, "media or text required", "too late to delete for everyone") |
| `401` | Missing/invalid/expired access token; bad login; revoked refresh token |
| `403` | Not verified; banned; not a conversation participant; deleting another user's message; messaging a blocked user; admin-only / owner-only resource |
| `404` | Unknown user/conversation/message/status/report |
| `409` | Email already registered |
| `422` | Validation failed — `data` is `[{ field, message }]` |
| `429` | Rate limit (auth routes) |
| `500` | Unexpected (message masked) |

**422 example:**
```json
{ "success": false, "message": "Validation failed",
  "data": [{ "field": "email", "message": "A valid email is required" }] }
```

---

## 7. Rate Limiting

`/api/auth/*` — 100 requests / 15 min / IP (Redis-backed). Other routes are not rate-limited.

---

## 8. Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `PORT` | no | default `5000` |
| `CORS_ORIGIN` | yes | allowed browser origin (also Socket.io CORS) |
| `MONGODB_URI` | yes | MongoDB connection string |
| `REDIS_URL` | yes | `redis://…` (cloud TLS ⇒ `rediss://`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | yes | token signing |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | no | `15m` / `7d` |
| `BCRYPT_ROUNDS` | no | `10` |
| `OTP_TTL_MINUTES` | no | `10` |
| `SMTP_HOST/PORT/USER/PASS/FROM` | for email | OTP + offline-message emails |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | for media | avatars, status, image/file messages |
| `ADMIN_EMAIL` | for admin | account auto-promoted to `admin` on startup |
| `DELETE_FOR_EVERYONE_WINDOW_SECONDS` | no | `3600` — window for "delete for everyone" |
| `EXPO_ACCESS_TOKEN` | for push | Expo push notifications |
| `STUN_URLS` / `TURN_URLS` / `TURN_STATIC_AUTH_SECRET` / `METERED_API_KEY` / `METERED_DOMAIN` | for calls | ICE/TURN config |

---

# REST API Reference

> Protected endpoints require `Authorization: Bearer <accessToken>` (or the web auth cookie).
> User context (`req.user`) is always derived from the token, never the body.

---

## Section A — Authentication (`/api/auth`)

> Rate-limited. No auth required.

| Method | Path | Body | Success |
|--------|------|------|---------|
| POST | `/register` | `{ name, email, password }` | `201` `{ userId }` — OTP emailed (queued) |
| POST | `/verify-otp` | `{ email, code }` | `200` |
| POST | `/resend-otp` | `{ email }` | `200` |
| POST | `/login` | `{ email, password }` | `200` `{ accessToken, refreshToken, user }` |
| POST | `/refresh` | `{ refreshToken }` (or cookie) | `200` `{ accessToken }` |
| POST | `/logout` | `{ refreshToken }` (or cookie) | `200` |
| POST | `/forgot-password` | `{ email }` | `200` (always identical — never reveals if the email exists) |
| POST | `/reset-password` | `{ email, code, password }` | `200` — also verifies the account and revokes all sessions |

**`login` → `user`:**
```json
{ "userId": "USR-A1B2C3", "name": "Alice", "email": "alice@example.com",
  "avatar": "", "isVerified": true, "isVerifiedAccount": false,
  "role": "user", "isActive": true }
```

---

## Section B — Users (`/api/users`)

> All require auth.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/me` | Current profile (cached 300s, invalidated on change). |
| PATCH | `/me` | Body `{ name?, avatar? }`. Email/password not editable here. |
| POST | `/me/avatar` | **multipart** `avatar` (image only) → uploads to Cloudinary, returns profile. |
| GET | `/search?q=` | Verified users matching name/email (≤20), excludes you. Online status hidden for blocked relationships. |
| GET | `/blocked` | Users you've blocked → `[{ userId, name, avatar }]`. |
| POST | `/block/:userId` | `{ userId, blocked: true }`. |
| POST | `/unblock/:userId` | `{ userId, blocked: false }`. |
| POST | `/report/:userId` | Body `{ reason }` (≤500). `201 { reportId }`. |
| GET | `/:userId` | Public profile. `isOnline`/`lastSeen` are hidden (false/null) if either user has blocked the other. |

**`/me` response:**
```json
{ "userId": "USR-A1B2C3", "name": "Alice", "email": "alice@example.com", "avatar": "",
  "role": "user", "isActive": true, "isOnline": false, "lastSeen": "2026-06-09T02:10:00.000Z",
  "isVerified": true, "isVerifiedAccount": false, "createdAt": "2026-06-09T02:13:48.501Z" }
```

> `isVerified` = email/OTP confirmed (gates login). `isVerifiedAccount` = admin-granted "verified" badge (the blue tick) — distinct concept.

---

## Section C — Conversations (`/api/conversations`)

> All require auth.

### C.1 Create or fetch — `POST /`
Body: `{ type?, participantId?, participants?, name? }`.
- **direct** (default): `participantId` (USR-). Deduplicated — returns the existing 1:1 if present (`200`), else creates (`201`). Blocked either way → `403`.
- **group**: `name` + `participants` (USR-[]). `201`.

Returns the **conversation detail** shape (below).

### C.2 List — `GET /`
Your conversations, newest-activity first (cached per user, 30s). Array of **list items**:
```json
{ "conversationId": "CVE-…", "type": "direct", "name": null,
  "otherParticipants": [{ "userId": "USR-…", "name": "Bob", "avatar": "", "isOnline": false, "lastSeen": null }],
  "lastMessage": { "messageId": "MSG-…", "content": "Hi", "type": "text", "sender": "USR-…", "createdAt": "…" },
  "unreadCount": 2, "muted": false, "updatedAt": "…" }
```

### C.3 Detail — `GET /:conversationId`
Participant-only. **Conversation detail** shape:
```json
{ "conversationId": "CVE-…", "type": "direct", "name": null,
  "participants": [{ "userId": "USR-…", "name": "Alice", "avatar": "", "isOnline": true, "lastSeen": null }],
  "createdBy": "USR-…",
  "lastMessage": { "messageId": "MSG-…", "content": "Hi", "type": "text", "createdAt": "…", "sender": "USR-…" },
  "muted": false, "createdAt": "…", "updatedAt": "…" }
```

### C.4 Other actions
| Method | Path | Effect |
|--------|------|--------|
| DELETE | `/:conversationId` | **group** → leave (deleted once empty); **direct** → delete outright. |
| POST | `/:conversationId/clear` | Clear history **for you only** (others keep theirs). Hides messages older than now in your fetches. |
| POST | `/:conversationId/mute` | `{ muted: true }` — suppresses your offline email/push/bell for this chat. |
| POST | `/:conversationId/unmute` | `{ muted: false }`. |

---

## Section D — Messages (`/api/messages`)

> All require auth. Sending also drives the real-time layer (§11) and the notification queue.

### D.1 Send — `POST /`
Two content types:
- **Text (JSON):** `{ conversationId, content, type? }` (`type`: `text` default).
- **Image/File (multipart):** a `file` part (image or PDF, ≤10MB) + `conversationId` + optional `caption`. The backend verifies, uploads to Cloudinary, and derives `type` = `image`|`file`.

Blocked direct chat → `403`. Returns the **message** shape:
```json
{ "messageId": "MSG-…", "conversationId": "CVE-…", "sender": "USR-…",
  "content": "Hello", "type": "text", "readBy": ["USR-…"], "isDeleted": false,
  "createdAt": "…", "attachment": { "originalName": "f.pdf", "mimeType": "application/pdf", "size": 1234, "caption": "…" } }
```
(`attachment` present only for image/file messages.)

### D.2 Other actions
| Method | Path | Notes |
|--------|------|-------|
| GET | `/:conversationId?cursor=&limit=` | History, newest-first, cursor-paginated (`limit` 1–100, default 20). Returns `{ items[], nextCursor }`. Excludes soft-deleted, messages you "deleted for me", and (per "clear chat") anything older than your `clearedAt`. |
| POST | `/:conversationId/read` | Mark all unread read → `{ modified }`. |
| PATCH | `/:messageId/read` | Mark one read (idempotent). Emits `message:read`. |
| DELETE | `/:messageId?scope=me\|everyone` | `me` hides it for you; `everyone` (default) soft-deletes for all — **sender only, within `DELETE_FOR_EVERYONE_WINDOW_SECONDS`** (else `403`/`400`). |

---

## Section E — Status / Stories (`/api/status`)

> All require auth. Ephemeral photo/video/text that auto-expires after 24h (Mongo TTL index).
> Visibility = your **contacts** (users you share a conversation with) + yourself.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/` | **media**: multipart `media` (image/video) + `caption?`; **or text**: JSON `{ text, bgColor?, caption? }` (`bgColor` hex). One of media/text required. → status. |
| GET | `/feed` | Active statuses grouped by author, your own first, then unseen. Array of `{ user, isMine, statuses[], hasUnseen, lastCreatedAt }`. |
| GET | `/user/:userId` | One author's active statuses (contacts only) → `{ user, isMine, statuses[] }`. |
| POST | `/:statusId/view` | Record that you viewed it (idempotent; owner is a no-op). |
| GET | `/:statusId/viewers` | **Owner only** → `{ count, viewers: [{ userId, name, avatar, isOnline }] }`. |
| DELETE | `/:statusId` | **Owner only** — also deletes the Cloudinary asset. |

**status shape:**
```json
{ "statusId": "STA-…", "type": "image", "mediaUrl": "https://…", "thumbnailUrl": "https://…",
  "text": "", "bgColor": "#2563EB", "caption": "", "duration": 0,
  "createdAt": "…", "expiresAt": "…", "viewed": false, "viewersCount": 3 }
```
`type` ∈ `image|video|text`. `viewersCount` present only on your own statuses.

---

## Section F — Calls (`/api/calls`)

> All require auth. WebRTC media is peer-to-peer; the **signaling** is socket-only (§11). These
> REST routes expose history + ICE config.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/?cursor=&limit=` | Call history (newest-first, cursor-paginated) → `{ items[], nextCursor }`. |
| GET | `/ice-servers` | STUN/TURN config → `{ iceServers: [{ urls, username?, credential? }] }`. |
| GET | `/:callId` | One call record (participant only). |

**call shape:**
```json
{ "callId": "CAL-…", "type": "video", "status": "ended",
  "caller": { "userId": "USR-…", "name": "Alice", "avatar": "" },
  "callee": { "userId": "USR-…", "name": "Bob", "avatar": "" },
  "conversationId": "CVE-…", "startedAt": "…", "answeredAt": "…", "endedAt": "…",
  "durationSec": 42, "endReason": "hangup", "endedBy": "USR-…", "createdAt": "…" }
```

---

## Section G — Notifications (`/api/notifications`)

> All require auth.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/?cursor=&limit=` | In-app notifications, newest-first → `{ items[], nextCursor }`. |
| GET | `/unread-count` | `{ count }`. |
| PATCH | `/read-all` | Mark all read → `{ modified }`. |
| PATCH | `/:notificationId/read` | Mark one read. |
| DELETE | `/:notificationId` | Remove one. |
| POST | `/push-tokens` | Body `{ token }` (Expo push token) — register this device. |
| DELETE | `/push-tokens` | Body `{ token }` — unregister. |

**notification shape:**
```json
{ "notificationId": "NOT-…", "type": "message", "title": "Alice", "body": "Hi",
  "data": { "conversationId": "CVE-…" }, "isRead": false,
  "sender": { "userId": "USR-…", "name": "Alice", "avatar": "" }, "createdAt": "…" }
```
`type` ∈ `message|call_incoming|call_missed|group_added|new_chat`.

---

## Section H — Admin (`/api/admin`)

> Require auth **and** the `admin` role (checked against the DB). First admin via `ADMIN_EMAIL`.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/stats` | `{ users{total,verified,admins,onlineNow}, conversations{total,direct,group}, messages{total,today,week}, timeSeries{signupsPerDay[],messagesPerDay[]} }`. |
| GET | `/users?search=&filter=&sort=&page=&limit=` | Paginated. `filter` ∈ verified/unverified/online/admin/user/active/banned; `sort` ∈ newest/oldest/name. → `{ items[], page, limit, total, totalPages }`. |
| PATCH | `/users/:userId` | Body any of `{ role, isVerified, isVerifiedAccount, isActive }`. Can't demote/suspend yourself. Banning revokes sessions. |
| DELETE | `/users/:userId` | Removes the user + their messages, prunes conversations. |
| GET | `/conversations?page=&limit=` | Paginated, with participant previews + message counts. |
| DELETE | `/conversations/:conversationId` | Delete a conversation + its messages. |
| GET | `/messages?conversationId=&senderId=&page=&limit=` | Moderation list. |
| DELETE | `/messages/:messageId` | Soft-delete (sets `isDeleted`, clears content). |
| GET | `/reports?status=&page=&limit=` | User-report queue (`status` ∈ open/reviewed/dismissed). Items resolve `reporter`/`reported` to `{ userId, name, avatar }`. |
| PATCH | `/reports/:reportId` | Body `{ status }` (open/reviewed/dismissed). |

---

## 11. Real-time API (Socket.io)

Connect (token in handshake; web uses the cookie):
```js
const socket = io("http://localhost:5000", { auth: { token: accessToken } });
```
On connect the socket joins a private room named after the user's **`userId`** — all targeted
delivery uses these per-user rooms (multi-instance fan-out via the Redis adapter).

**Client → Server**

| Event | Payload | Ack |
|-------|---------|-----|
| `message:send` | `{ conversationId, content, type? }` | `{ success, message }` / `{ success:false, error }` |
| `message:read` | `{ messageId }` | — |
| `typing:start` / `typing:stop` | `{ conversationId }` | — |
| `call:initiate` | `{ calleeId, type, conversationId? }` | `{ success, callId }` / busy/error |
| `call:accept` / `call:reject` / `call:end` | `{ callId }` | `{ success }` |
| `call:offer` / `call:answer` | `{ callId, sdp }` | `{ success }` |
| `call:ice-candidate` | `{ callId, candidate }` | `{ success }` |
| `call:ice-servers` | — | `{ success, iceServers }` |

**Server → Client**

| Event | Payload |
|-------|---------|
| `message:new` | the saved message |
| `message:read` | `{ messageId, conversationId, userId }` |
| `typing:start` / `typing:stop` | `{ conversationId, userId }` |
| `user:status` | `{ userId, isOnline, lastSeen? }` |
| `notification:new` | the notification (often with `unreadCount`) |
| `story:new` | `{ status, author }` — a contact posted a status |
| `story:viewed` | `{ statusId, viewerId, viewersCount }` — to the owner |
| `call:incoming` | `{ callId, type, caller }` |
| `call:accepted` / `call:rejected` / `call:ended` / `call:missed` / `call:busy` / `call:error` | call lifecycle |
| `call:offer` / `call:answer` / `call:ice-candidate` | relayed WebRTC signaling |

---

## 12. Appendix — Endpoint Index

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register` · `/verify-otp` · `/resend-otp` · `/login` · `/refresh` · `/logout` · `/forgot-password` · `/reset-password` | No |
| GET/PATCH | `/api/users/me` | Yes |
| POST | `/api/users/me/avatar` | Yes |
| GET | `/api/users/search` · `/blocked` · `/:userId` | Yes |
| POST | `/api/users/block/:userId` · `/unblock/:userId` · `/report/:userId` | Yes |
| POST/GET | `/api/conversations` | Yes |
| GET/DELETE | `/api/conversations/:conversationId` | Yes |
| POST | `/api/conversations/:conversationId/clear` · `/mute` · `/unmute` | Yes |
| POST | `/api/messages` | Yes |
| GET | `/api/messages/:conversationId` | Yes |
| POST | `/api/messages/:conversationId/read` | Yes |
| PATCH/DELETE | `/api/messages/:messageId/read` · `/api/messages/:messageId` | Yes |
| POST/GET | `/api/status` · `/api/status/feed` | Yes |
| GET | `/api/status/user/:userId` · `/api/status/:statusId/viewers` | Yes |
| POST/DELETE | `/api/status/:statusId/view` · `/api/status/:statusId` | Yes |
| GET | `/api/calls` · `/api/calls/ice-servers` · `/api/calls/:callId` | Yes |
| GET | `/api/notifications` · `/unread-count` | Yes |
| PATCH | `/api/notifications/read-all` · `/:notificationId/read` | Yes |
| DELETE | `/api/notifications/:notificationId` | Yes |
| POST/DELETE | `/api/notifications/push-tokens` | Yes |
| GET | `/api/admin/stats` · `/users` · `/conversations` · `/messages` · `/reports` | Admin |
| PATCH | `/api/admin/users/:userId` · `/reports/:reportId` | Admin |
| DELETE | `/api/admin/users/:userId` · `/conversations/:conversationId` · `/messages/:messageId` | Admin |
| GET | `/health` | No |
