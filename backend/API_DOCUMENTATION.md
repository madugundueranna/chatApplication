# Chat Application — API Documentation

Real-time chat backend built with **Express + MongoDB (Mongoose) + Redis (ioredis) +
Socket.io + BullMQ** (ES Modules). This document is the source of truth for the REST API and
the Socket.io real-time contract, and is structured for direct use in Postman.

---

## 1. Project Overview

| Item | Value |
|------|-------|
| Name | `chat-backend` |
| Purpose | Real-time 1:1 and group chat with auth, presence, typing, read receipts, and offline notifications |
| Runtime | Node.js ≥ 20 (ES Modules) |
| Transport | REST (HTTP/JSON) + Socket.io (WebSocket) |
| Persistence | MongoDB (Mongoose) |
| Cache / presence / pub-sub | Redis (single shared `ioredis` client) |
| Background jobs | BullMQ (`notifications` queue + worker) |
| Auth | JWT access + refresh tokens; `bcrypt` password hashing; email OTP verification |

**Resource model**
- **User** — account, profile, verification state, presence, refresh tokens.
- **Conversation** ("Chat") — `direct` (2 participants) or `group` (N participants).
- **Message** — belongs to a conversation; tracks `readBy` and soft-delete.

---

## 2. Base URL

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:5000` |
| API prefix | `/api` |
| Health check | `GET http://localhost:5000/health` |
| Landing page | `GET http://localhost:5000/` (HTML) |

All REST endpoints below are relative to `http://localhost:5000/api`.
Socket.io connects to the root origin `http://localhost:5000` (not under `/api`).

---

## 3. API Versioning

**Current:** the API is **unversioned** — routes are mounted directly under `/api` (e.g.
`/api/auth/login`). There is no `/v1` segment.

**Recommendation:** when a breaking change is needed, introduce a prefix (`/api/v1`) and keep
the old version mounted until clients migrate. The router structure (one router per resource)
makes this a one-line change in `app.js`.

---

## 4. Authentication Flow

JWT-based, with email OTP verification before first login.

```
register ──▶ (OTP emailed) ──▶ verify-otp ──▶ login ──▶ { accessToken, refreshToken }
                                   ▲                          │
                              resend-otp                      │ accessToken expires (15m)
                                                              ▼
                                                          refresh ──▶ new accessToken
                                                              │
                                                           logout ──▶ refreshToken revoked
```

1. **Register** with name/email/password → user created as unverified; a 6-digit OTP is
   **enqueued** and emailed (the request does not block on email sending).
2. **Verify OTP** → account marked verified, OTP cleared.
3. **Login** (rejected until verified) → returns a short-lived `accessToken` and a long-lived
   `refreshToken`. The refresh token is stored on the user (multi-device).
4. **Authenticated requests** send `Authorization: Bearer <accessToken>`.
5. **Refresh** exchanges a valid, non-revoked `refreshToken` for a new `accessToken`.
6. **Logout** removes the supplied `refreshToken` from the user (that device is signed out).

| Token | Lifetime (default) | Sent as | Configurable via |
|-------|--------------------|---------|------------------|
| Access | `15m` | `Authorization: Bearer <token>` header | `JWT_ACCESS_EXPIRES` |
| Refresh | `7d` | JSON body `{ "refreshToken": "..." }` | `JWT_REFRESH_EXPIRES` |

**Socket.io auth:** pass the access token in the handshake — `io(URL, { auth: { token } })`.
Invalid/missing tokens are rejected at the handshake (`connect_error`).

---

## 5. Common Response Format

Every JSON response uses a single envelope:

```json
{
  "success": true,
  "message": "Human-readable summary",
  "data": { }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` for 2xx, `false` for errors |
| `message` | string | Human-readable summary |
| `data` | object \| array \| null | Payload on success; `null` (or a field-error array on validation failures) otherwise |

---

## 6. Error Handling Standards

All errors return the common envelope with `success: false` and `data: null` (except validation
errors, where `data` is an array of field errors). Errors are produced by a central
`ApiError` + global error middleware; controllers never format errors inline.

| HTTP Status | Meaning | When it occurs |
|-------------|---------|----------------|
| `400 Bad Request` | Malformed/invalid operation | Invalid OTP, business-rule violation (e.g. self-conversation), invalid identifier (`CastError`) |
| `401 Unauthorized` | Missing/invalid credentials | No/invalid/expired access token; bad login; revoked refresh token |
| `403 Forbidden` | Authenticated but not allowed | Account not verified; not a conversation participant; deleting another user's message |
| `404 Not Found` | Resource missing | Unknown user/conversation/message; unmatched route (returns HTML 404 page) |
| `409 Conflict` | Duplicate | Email already registered (also Mongo duplicate-key `11000`) |
| `422 Unprocessable Entity` | Validation failed | `express-validator` chain failed; `data` lists `{ field, message }` |
| `429 Too Many Requests` | Rate limit hit | More than 20 requests/15 min to `/api/auth/*` |
| `500 Internal Server Error` | Unexpected | Unhandled error; message is masked to `Internal server error` |

**Validation error example (`422`):**
```json
{
  "success": false,
  "message": "Validation failed",
  "data": [
    { "field": "email", "message": "A valid email is required" },
    { "field": "password", "message": "Password must be at least 6 characters" }
  ]
}
```

**Generic error example:**
```json
{ "success": false, "message": "Invalid or expired token", "data": null }
```

---

## 7. Rate Limiting Information

| Scope | Limit | Window | Store | Notes |
|-------|-------|--------|-------|-------|
| `/api/auth/*` | 20 requests | 15 minutes | Redis (`rate-limit-redis`) | Per client IP; shared across instances via Redis |
| All other routes | Unlimited | — | — | Not rate-limited in the current version |

When exceeded, responds `429`:
```json
{ "success": false, "message": "Too many attempts, please try again later.", "data": null }
```
Standard rate-limit headers (`RateLimit-*`) are returned.

---

## 8. Environment Variables

Copy `.env.example` → `.env` and fill in values.

| Variable | Required | Example / Default | Description |
|----------|----------|-------------------|-------------|
| `NODE_ENV` | no | `development` | Runtime environment |
| `PORT` | no | `5000` | HTTP port |
| `CORS_ORIGIN` | yes | `http://localhost:3000` | Allowed browser origin (also used for Socket.io CORS) |
| `MONGODB_URI` | yes | `mongodb://127.0.0.1:27017/chatApplication` | MongoDB connection string |
| `REDIS_URL` | yes | `redis://127.0.0.1:6379` | Redis URL. Cloud Redis requiring TLS (e.g. Upstash) **must** use `rediss://` |
| `JWT_ACCESS_SECRET` | yes | (random string) | Signs access tokens |
| `JWT_ACCESS_EXPIRES` | no | `15m` | Access token lifetime |
| `JWT_REFRESH_SECRET` | yes | (random string) | Signs refresh tokens |
| `JWT_REFRESH_EXPIRES` | no | `7d` | Refresh token lifetime |
| `BCRYPT_ROUNDS` | no | `10` | bcrypt cost factor |
| `OTP_TTL_MINUTES` | no | `10` | OTP validity window |
| `SMTP_HOST` | yes (for email) | `smtp.gmail.com` | SMTP server host |
| `SMTP_PORT` | yes (for email) | `587` | SMTP port (`465` ⇒ implicit TLS, else STARTTLS) |
| `SMTP_USER` | yes (for email) | `you@gmail.com` | SMTP username |
| `SMTP_PASS` | yes (for email) | (app password) | SMTP password / Gmail App Password |
| `SMTP_FROM` | yes (for email) | `Chat App <you@gmail.com>` | From header (Gmail rewrites to the authenticated user) |

> `CLOUDINARY_*` / `GOOGLE_*` keys may appear in some `.env` files but are **not used** by the
> current code (file upload and OAuth are not implemented — see §15–17).

---

# REST API Reference

> Conventions for every endpoint below:
> - **Request Headers:** `Content-Type: application/json` for requests with a body; protected
>   endpoints also require `Authorization: Bearer <accessToken>`.
> - **Error Responses:** all follow §6. Only endpoint-specific cases are called out.
> - All authenticated user context (`req.user.id`) is derived from the access token, never the body.

---

## Section A — Authentication (`/api/auth`)

> Rate-limited: 20 requests / 15 min / IP. No authentication required (these establish it).

### A.1 Register

| | |
|---|---|
| **Endpoint Name** | Register |
| **HTTP Method** | `POST` |
| **URL Path** | `/api/auth/register` |
| **Purpose** | Create an unverified account and email an OTP |
| **Auth Required** | No |
| **Path Params** | None |
| **Query Params** | None |

**Request Headers**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

**Request Body Schema**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | yes | Non-empty (trimmed) |
| `email` | string | yes | Valid email; normalized to lowercase |
| `password` | string | yes | Min length 6 |

**Success Response — `201 Created`**
```json
{
  "success": true,
  "message": "Registered. Verify the OTP sent to your email.",
  "data": { "userId": "6a2776dc48722dfdf84de4e8" }
}
```

**Error Responses**

| Status | Reason |
|--------|--------|
| `409` | Email already registered |
| `422` | Validation failed |
| `429` | Rate limited |

**Example Request**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"secret123"}'
```

**Notes / Business Rules**
- The OTP email is **enqueued** (BullMQ); the response returns immediately and does not wait for SMTP.
- The OTP is never returned in the response.

---

### A.2 Verify OTP

| | |
|---|---|
| **Endpoint Name** | Verify OTP |
| **HTTP Method** | `POST` |
| **URL Path** | `/api/auth/verify-otp` |
| **Purpose** | Verify the emailed OTP and activate the account |
| **Auth Required** | No |

**Request Body Schema**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `email` | string | yes | Valid email |
| `code` | string | yes | Length 4–8 |

**Success Response — `200 OK`**
```json
{ "success": true, "message": "Account verified", "data": null }
```
(If already verified: `message: "Already verified"`.)

**Error Responses**

| Status | Reason |
|--------|--------|
| `400` | Invalid or expired OTP |
| `404` | User not found |
| `422` | Validation failed |

**Example Request**
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","code":"278615"}'
```

**Notes / Business Rules**
- OTP validity is `OTP_TTL_MINUTES` (default 10). On success the OTP is cleared.

---

### A.3 Resend OTP

| | |
|---|---|
| **Endpoint Name** | Resend OTP |
| **HTTP Method** | `POST` |
| **URL Path** | `/api/auth/resend-otp` |
| **Purpose** | Regenerate and re-email an OTP |
| **Auth Required** | No |

**Request Body Schema**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `email` | string | yes | Valid email |

**Success Response — `200 OK`**
```json
{ "success": true, "message": "OTP resent", "data": null }
```

**Error Responses**

| Status | Reason |
|--------|--------|
| `400` | Account already verified |
| `404` | User not found |
| `422` | Validation failed |

---

### A.4 Login

| | |
|---|---|
| **Endpoint Name** | Login |
| **HTTP Method** | `POST` |
| **URL Path** | `/api/auth/login` |
| **Purpose** | Authenticate and issue tokens |
| **Auth Required** | No |

**Request Body Schema**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `email` | string | yes | Valid email |
| `password` | string | yes | Non-empty |

**Success Response — `200 OK`**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "6a2776dc48722dfdf84de4e8",
      "name": "Alice",
      "email": "alice@example.com",
      "avatar": "",
      "isVerified": true
    }
  }
}
```

**Error Responses**

| Status | Reason |
|--------|--------|
| `401` | Invalid credentials |
| `403` | Account not verified |
| `422` | Validation failed |

**Notes / Business Rules**
- Login is rejected with `403` until the account is verified.
- Each successful login appends a refresh token to the user (supports multi-device sessions).

---

### A.5 Refresh Access Token

| | |
|---|---|
| **Endpoint Name** | Refresh Token |
| **HTTP Method** | `POST` |
| **URL Path** | `/api/auth/refresh` |
| **Purpose** | Exchange a refresh token for a new access token |
| **Auth Required** | No (the refresh token itself is the credential) |

**Request Body Schema**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `refreshToken` | string | yes | Non-empty |

**Success Response — `200 OK`**
```json
{ "success": true, "message": "Token refreshed", "data": { "accessToken": "eyJ..." } }
```

**Error Responses**

| Status | Reason |
|--------|--------|
| `401` | Invalid refresh token, or token revoked (not on the user) |
| `422` | Validation failed |

---

### A.6 Logout

| | |
|---|---|
| **Endpoint Name** | Logout |
| **HTTP Method** | `POST` |
| **URL Path** | `/api/auth/logout` |
| **Purpose** | Revoke a refresh token (sign out one device) |
| **Auth Required** | No |

**Request Body Schema**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `refreshToken` | string | yes | Non-empty |

**Success Response — `200 OK`**
```json
{ "success": true, "message": "Logged out", "data": null }
```

**Notes / Business Rules**
- Idempotent: returns `200` even if the token was already absent.

---

## Section B — Users (`/api/users`)

> **All endpoints require authentication** (`Authorization: Bearer <accessToken>`).

### B.1 Get My Profile

| | |
|---|---|
| **Endpoint Name** | Get Current User |
| **HTTP Method** | `GET` |
| **URL Path** | `/api/users/me` |
| **Purpose** | Return the authenticated user's profile |
| **Auth Required** | Yes |
| **Body** | None |

**Success Response — `200 OK`**
```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "_id": "6a2776dc48722dfdf84de4e8",
    "name": "Alice",
    "email": "alice@example.com",
    "avatar": "",
    "isOnline": false,
    "lastSeen": "2026-06-09T02:10:00.000Z",
    "isVerified": true,
    "createdAt": "2026-06-09T02:13:48.501Z"
  }
}
```

**Error Responses:** `401` (no/invalid token), `404` (user deleted).

**Notes / Business Rules**
- **Cache-aside**: the profile is cached in Redis (TTL 300s) and invalidated on update.

---

### B.2 Update My Profile

| | |
|---|---|
| **Endpoint Name** | Update Current User |
| **HTTP Method** | `PATCH` |
| **URL Path** | `/api/users/me` |
| **Purpose** | Update name and/or avatar |
| **Auth Required** | Yes |

**Request Body Schema** (send any subset)

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | no | If present, non-empty |
| `avatar` | string | no | If present, a string (e.g. a CDN URL) |

**Success Response — `200 OK`** — same shape as B.1 with updated values.

**Error Responses:** `401`, `404`, `422`.

**Notes / Business Rules**
- Invalidates the cached profile. Email and password are **not** editable here.

---

### B.3 Search Users

| | |
|---|---|
| **Endpoint Name** | Search Users |
| **HTTP Method** | `GET` |
| **URL Path** | `/api/users/search` |
| **Purpose** | Find other verified users by name or email |
| **Auth Required** | Yes |

**Query Parameters**

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `q` | string | yes | Non-empty; case-insensitive match on name or email |

**Success Response — `200 OK`**
```json
{
  "success": true,
  "message": "Search results",
  "data": [
    { "_id": "6a2776f348722dfdf84de4f1", "name": "Bob", "avatar": "", "isOnline": false }
  ]
}
```

**Error Responses:** `401`, `422` (missing `q`).

**Notes / Business Rules**
- Excludes the requester; returns only **verified** users; max 20 results (single aggregation).
- Only public fields are returned (`_id, name, avatar, isOnline`).

**Example Request**
```bash
curl "http://localhost:5000/api/users/search?q=bob" -H "Authorization: Bearer $TOKEN"
```

---

### B.4 Get User By ID

| | |
|---|---|
| **Endpoint Name** | Get User By ID |
| **HTTP Method** | `GET` |
| **URL Path** | `/api/users/:id` |
| **Purpose** | Public profile of a specific user |
| **Auth Required** | Yes |

**Path Parameters**

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | yes | Valid Mongo ObjectId |

**Success Response — `200 OK`**
```json
{
  "success": true,
  "message": "User fetched",
  "data": {
    "_id": "6a2776f348722dfdf84de4f1",
    "name": "Bob",
    "avatar": "",
    "isOnline": false,
    "lastSeen": "2026-06-09T02:09:00.000Z"
  }
}
```

**Error Responses:** `401`, `404` (no such user), `422` (id not a valid ObjectId).

---

## Section C — Chats / Conversations (`/api/conversations`)

> **All endpoints require authentication.** A "Chat" is a `Conversation` (`direct` or `group`).

### C.1 Create or Fetch Conversation

| | |
|---|---|
| **Endpoint Name** | Create / Fetch Conversation |
| **HTTP Method** | `POST` |
| **URL Path** | `/api/conversations` |
| **Purpose** | Start (or fetch an existing) direct chat, or create a group |
| **Auth Required** | Yes |

**Request Body Schema**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `type` | string | no | `direct` (default) or `group` |
| `participantId` | string | for `direct` | Valid ObjectId of the other user |
| `participants` | string[] | for `group` | Non-empty array of ObjectIds |
| `name` | string | for `group` | Non-empty group name |

**Validation Rules**
- `type` ∈ {`direct`, `group`}; `participantId` and each `participants[*]` must be valid ObjectIds;
  `name` (if present) non-empty. Resource-level rules (below) are enforced in the controller.

**Success Response**
- **Direct, existing** → `200 OK`, `message: "Conversation fetched"`
- **Direct, new** → `201 Created`, `message: "Conversation created"`
- **Group, new** → `201 Created`, `message: "Group created"`

```json
{
  "success": true,
  "message": "Conversation created",
  "data": {
    "_id": "6a2776f448722dfdf84de4f7",
    "type": "direct",
    "participants": ["6a2776dc48722dfdf84de4e8", "6a2776f348722dfdf84de4f1"],
    "createdBy": "6a2776dc48722dfdf84de4e8",
    "createdAt": "2026-06-09T02:14:12.493Z",
    "updatedAt": "2026-06-09T02:14:12.493Z",
    "__v": 0
  }
}
```

**Error Responses**

| Status | Reason |
|--------|--------|
| `400` | `direct` without `participantId`; conversation with yourself; `group` without `name`/`participants` |
| `401` | Not authenticated |
| `422` | Invalid ObjectId / type |

**Notes / Business Rules**
- **Direct chats are deduplicated**: an existing 2-party direct conversation is returned instead of creating a duplicate.
- The requester is always added to `participants` (groups dedupe members).
- Affected participants' cached conversation lists are invalidated.

---

### C.2 List My Conversations

| | |
|---|---|
| **Endpoint Name** | List Conversations |
| **HTTP Method** | `GET` |
| **URL Path** | `/api/conversations` |
| **Purpose** | All conversations for the user with last message + unread count |
| **Auth Required** | Yes |
| **Body** | None |

**Success Response — `200 OK`**
```json
{
  "success": true,
  "message": "Conversations fetched",
  "data": [
    {
      "_id": "6a2776f448722dfdf84de4f7",
      "type": "direct",
      "updatedAt": "2026-06-09T02:14:12.653Z",
      "otherParticipants": [
        { "_id": "6a2776f348722dfdf84de4f1", "name": "Bob", "avatar": "", "isOnline": false }
      ],
      "lastMessage": {
        "_id": "6a2776f448722dfdf84de4fa",
        "content": "Hello Bob!",
        "type": "text",
        "sender": "6a2776dc48722dfdf84de4e8",
        "createdAt": "2026-06-09T02:14:12.652Z"
      },
      "unreadCount": 0
    }
  ]
}
```

**Error Responses:** `401`.

**Notes / Business Rules**
- Built from a **single aggregation pipeline** (joins last message + other participants, computes
  unread per conversation), sorted by `updatedAt` desc.
- Result is **cached per user** (TTL 30s) and invalidated whenever a message is sent in any of the
  user's conversations or read state changes.
- `unreadCount` = messages where `sender ≠ me` and `me ∉ readBy` (excludes deleted).

---

### C.3 Get Conversation Details

| | |
|---|---|
| **Endpoint Name** | Get Conversation |
| **HTTP Method** | `GET` |
| **URL Path** | `/api/conversations/:id` |
| **Purpose** | Full conversation with populated participants |
| **Auth Required** | Yes |

**Path Parameters**

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | yes | Valid ObjectId |

**Success Response — `200 OK`**
```json
{
  "success": true,
  "message": "Conversation fetched",
  "data": {
    "_id": "6a2776f448722dfdf84de4f7",
    "type": "direct",
    "participants": [
      { "_id": "6a2776dc48722dfdf84de4e8", "name": "Alice", "avatar": "", "isOnline": true,  "lastSeen": null },
      { "_id": "6a2776f348722dfdf84de4f1", "name": "Bob",   "avatar": "", "isOnline": false, "lastSeen": "2026-06-09T02:09:00.000Z" }
    ],
    "createdBy": "6a2776dc48722dfdf84de4e8",
    "lastMessage": "6a2776f448722dfdf84de4fa",
    "createdAt": "2026-06-09T02:14:12.493Z",
    "updatedAt": "2026-06-09T02:14:12.653Z",
    "__v": 0
  }
}
```

**Error Responses**

| Status | Reason |
|--------|--------|
| `401` | Not authenticated |
| `403` | Requester is not a participant |
| `404` | Conversation not found |
| `422` | Invalid id |

---

### C.4 Delete / Leave Conversation

| | |
|---|---|
| **Endpoint Name** | Delete / Leave Conversation |
| **HTTP Method** | `DELETE` |
| **URL Path** | `/api/conversations/:id` |
| **Purpose** | Leave a group, or delete a direct conversation |
| **Auth Required** | Yes |

**Path Parameters**

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | yes | Valid ObjectId |

**Success Response — `200 OK`**
```json
{ "success": true, "message": "Conversation removed", "data": null }
```

**Error Responses:** `401`, `403` (not a participant), `404`, `422`.

**Notes / Business Rules**
- **Group:** removes the requester from `participants`; if it becomes empty the conversation is deleted.
- **Direct:** deletes the conversation entirely.
- Invalidates the cached conversation lists of all (former) participants.

---

## Section D — Messages (`/api/messages`)

> **All endpoints require authentication.** Sending a message also drives the real-time layer
> (see §11) and the notification queue (see §12).

### D.1 Send Message

| | |
|---|---|
| **Endpoint Name** | Send Message |
| **HTTP Method** | `POST` |
| **URL Path** | `/api/messages` |
| **Purpose** | Create a message in a conversation |
| **Auth Required** | Yes |

**Request Body Schema**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `conversationId` | string | yes | Valid ObjectId; requester must be a participant |
| `content` | string | yes | Non-empty |
| `type` | string | no | `text` (default), `image`, or `file` |

**Success Response — `201 Created`**
```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "_id": "6a2776f448722dfdf84de4fa",
    "conversation": "6a2776f448722dfdf84de4f7",
    "sender": "6a2776dc48722dfdf84de4e8",
    "content": "Hello Bob!",
    "type": "text",
    "readBy": ["6a2776dc48722dfdf84de4e8"],
    "isDeleted": false,
    "createdAt": "2026-06-09T02:14:12.652Z",
    "updatedAt": "2026-06-09T02:14:12.652Z",
    "__v": 0
  }
}
```

**Error Responses**

| Status | Reason |
|--------|--------|
| `401` | Not authenticated |
| `403` | Not a participant of the conversation |
| `404` | Conversation not found |
| `422` | Validation failed |

**Notes / Business Rules**
- For `image`/`file`, `content` should be the **media URL** (upload to S3/Cloudinary first; the API stores URLs only).
- Side effects: updates `conversation.lastMessage`, invalidates participants' conversation-list caches,
  emits `message:new` to each other participant's user room, and **enqueues** an email notification job
  for participants who are currently offline.
- The sender is automatically added to `readBy`.

---

### D.2 Get Message History (Cursor Paginated)

| | |
|---|---|
| **Endpoint Name** | Get Messages |
| **HTTP Method** | `GET` |
| **URL Path** | `/api/messages/:conversationId` |
| **Purpose** | Paginated message history, newest first |
| **Auth Required** | Yes |

**Path Parameters**

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `conversationId` | string | yes | Valid ObjectId; requester must be a participant |

**Query Parameters**

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `cursor` | string | no | A message ObjectId; returns messages older than it |
| `limit` | integer | no | 1–100 (default 20) |

**Success Response — `200 OK`**
```json
{
  "success": true,
  "message": "Messages fetched",
  "data": {
    "items": [
      {
        "_id": "6a2776f448722dfdf84de4fa",
        "conversation": "6a2776f448722dfdf84de4f7",
        "sender": "6a2776dc48722dfdf84de4e8",
        "content": "Hello Bob!",
        "type": "text",
        "readBy": ["6a2776dc48722dfdf84de4e8"],
        "isDeleted": false,
        "createdAt": "2026-06-09T02:14:12.652Z",
        "updatedAt": "2026-06-09T02:14:12.652Z",
        "__v": 0
      }
    ],
    "nextCursor": null
  }
}
```

**Error Responses:** `401`, `403`, `404`, `422`.

**Notes / Business Rules**
- **Cursor-based pagination** (no `skip`/`limit` offset). To load the next page, pass
  `cursor=<nextCursor>`. When `nextCursor` is `null`, there are no more messages.
- Soft-deleted messages are excluded.

**Example Request**
```bash
curl "http://localhost:5000/api/messages/6a2776f448722dfdf84de4f7?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

### D.3 Mark One Message Read

| | |
|---|---|
| **Endpoint Name** | Mark Message Read |
| **HTTP Method** | `PATCH` |
| **URL Path** | `/api/messages/:id/read` |
| **Purpose** | Add the requester to a message's `readBy` |
| **Auth Required** | Yes |

**Path Parameters**

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | yes | Valid message ObjectId |

**Success Response — `200 OK`**
```json
{ "success": true, "message": "Message marked read", "data": null }
```

**Error Responses:** `401`, `403` (not a participant), `404`, `422`.

**Notes / Business Rules**
- Idempotent (`$addToSet`). Emits `message:read` to all participants' user rooms.

---

### D.4 Mark Many Read (Bulk)

| | |
|---|---|
| **Endpoint Name** | Mark Conversation Read |
| **HTTP Method** | `POST` |
| **URL Path** | `/api/messages/:conversationId/read` |
| **Purpose** | Mark all unread messages in a conversation as read |
| **Auth Required** | Yes |

**Path Parameters**

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `conversationId` | string | yes | Valid ObjectId; requester must be a participant |

**Success Response — `200 OK`**
```json
{ "success": true, "message": "Messages marked read", "data": { "modified": 7 } }
```

**Error Responses:** `401`, `403`, `404`, `422`.

**Notes / Business Rules**
- Single `updateMany` over messages where `sender ≠ me` and `me ∉ readBy`.
- Invalidates the requester's cached conversation list (unread count changes).

---

### D.5 Delete Message (Soft Delete)

| | |
|---|---|
| **Endpoint Name** | Delete Message |
| **HTTP Method** | `DELETE` |
| **URL Path** | `/api/messages/:id` |
| **Purpose** | Soft-delete a message |
| **Auth Required** | Yes |

**Path Parameters**

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | yes | Valid message ObjectId |

**Success Response — `200 OK`**
```json
{ "success": true, "message": "Message deleted", "data": null }
```

**Error Responses**

| Status | Reason |
|--------|--------|
| `401` | Not authenticated |
| `403` | Only the sender may delete the message |
| `404` | Message not found |
| `422` | Invalid id |

**Notes / Business Rules**
- Sets `isDeleted: true` and clears `content` (soft delete). A daily cron hard-deletes messages
  soft-deleted more than 30 days ago.

---

## Section E — Notifications

There is **no REST endpoint** for notifications. Notifications are delivered two ways:

1. **Real-time (in-app)** via Socket.io events (see §11) — `message:new`, `message:read`,
   `typing:*`, `user:status`.
2. **Out-of-band** via a **BullMQ `notifications` queue**. When a message is sent, an email
   notification job is enqueued for any participant who is currently **offline** (presence is
   tracked in Redis). A background worker sends the emails via SMTP. OTP emails use the same queue.

| Aspect | Detail |
|--------|--------|
| Queue name | `notifications` |
| Job types | `otp-email`, `new-message` |
| Producer | Controllers/handlers enqueue only (never block on sending) |
| Consumer | Worker with concurrency 10; retries 3× with exponential backoff |
| Trigger (`new-message`) | Recipient is offline at send time |

> To expose a notification **history/read** API (e.g. `GET /api/notifications`), a `Notification`
> model and routes would need to be added — not present in the current version.

---

## 11. Real-time API (Socket.io)

**Connect** (token in the handshake):
```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { auth: { token: accessToken } });
```
Invalid/missing token → `connect_error` with message `Invalid or expired token` /
`Authentication token missing`. On connect, the socket auto-joins a room named after its `userId`;
all targeted delivery uses these per-user rooms (no global broadcasts). Multi-instance fan-out is
handled by the Redis adapter.

**Client → Server**

| Event | Payload | Ack callback | Description |
|-------|---------|--------------|-------------|
| `message:send` | `{ conversationId, content, type? }` | `{ success, message }` or `{ success:false, error }` | Persist + dispatch a message; ack returns the saved message so the client need not re-fetch |
| `message:read` | `{ messageId }` | — | Mark a message read; re-broadcast to participants |
| `typing:start` | `{ conversationId }` | — | Indicate typing (server-throttled to ~once/2s per user/conversation) |
| `typing:stop` | `{ conversationId }` | — | Stop typing |

**Server → Client**

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | the saved message object | Delivered to each *other* participant's room |
| `message:read` | `{ messageId, conversationId, userId }` | A participant read a message |
| `typing:start` | `{ conversationId, userId }` | A participant started typing |
| `typing:stop` | `{ conversationId, userId }` | A participant stopped typing |
| `user:status` | `{ userId, isOnline, lastSeen? }` | Presence change (broadcast on connect/disconnect) |

**Example**
```js
socket.emit("message:send", { conversationId, content: "hi" }, (ack) => {
  if (ack.success) console.log("saved", ack.message._id);
});
socket.on("message:new", (msg) => addToUI(msg));
socket.on("user:status", (s) => updatePresence(s));
```

---

## 15. Events

**Not implemented.** There is no "Events" resource/model or endpoints in the current backend.
(If "events" refers to real-time events, see the Socket.io contract in §11.)

## 16. Admin

**Not implemented.** There are no admin endpoints, no roles beyond a single `user`, and no
admin authorization layer in the current version. Adding this would require a role field on the
User model, role-aware middleware, and an `/api/admin/*` router.

## 17. File Uploads

**Not implemented as an endpoint.** By design the API stores **media URLs only** — clients upload
binaries to S3/Cloudinary and then send the resulting URL as a message with `type: "image" | "file"`
(see D.1). `CLOUDINARY_*` env keys may be present but are not wired into any route yet. A future
`POST /api/uploads` (signed upload or multipart → CDN) would slot in here.

---

## 18. Postman Collection Structure

Suggested collection layout. Create a **Collection** named **"Chat Application API"** with a
collection variable `baseUrl = http://localhost:5000` and `accessToken` (set automatically — see below).

```
Chat Application API/
├── Authentication/
│   ├── Register                  POST   {{baseUrl}}/api/auth/register
│   ├── Verify OTP                POST   {{baseUrl}}/api/auth/verify-otp
│   ├── Resend OTP                POST   {{baseUrl}}/api/auth/resend-otp
│   ├── Login                     POST   {{baseUrl}}/api/auth/login
│   ├── Refresh Token             POST   {{baseUrl}}/api/auth/refresh
│   └── Logout                    POST   {{baseUrl}}/api/auth/logout
├── Users/
│   ├── Get My Profile            GET    {{baseUrl}}/api/users/me
│   ├── Update My Profile         PATCH  {{baseUrl}}/api/users/me
│   ├── Search Users              GET    {{baseUrl}}/api/users/search?q=
│   └── Get User By ID            GET    {{baseUrl}}/api/users/:id
├── Chats (Conversations)/
│   ├── Create / Fetch            POST   {{baseUrl}}/api/conversations
│   ├── List Conversations        GET    {{baseUrl}}/api/conversations
│   ├── Get Conversation          GET    {{baseUrl}}/api/conversations/:id
│   └── Delete / Leave            DELETE {{baseUrl}}/api/conversations/:id
├── Messages/
│   ├── Send Message              POST   {{baseUrl}}/api/messages
│   ├── Get History               GET    {{baseUrl}}/api/messages/:conversationId?limit=20
│   ├── Mark One Read             PATCH  {{baseUrl}}/api/messages/:id/read
│   ├── Mark Conversation Read    POST   {{baseUrl}}/api/messages/:conversationId/read
│   └── Delete Message            DELETE {{baseUrl}}/api/messages/:id
└── (Health)
    └── Health Check              GET    {{baseUrl}}/health
```

**Collection-level settings**
- **Authorization:** set the collection auth to **Bearer Token** = `{{accessToken}}`; child requests
  inherit it. The Authentication folder requests override auth to **No Auth**.
- **Variables:** `baseUrl`, `accessToken`, `refreshToken`, plus convenience ids
  (`userId`, `conversationId`, `messageId`).
- **Login "Tests" script** (auto-capture tokens):
  ```js
  const json = pm.response.json();
  if (json?.data?.accessToken) {
    pm.collectionVariables.set("accessToken", json.data.accessToken);
    pm.collectionVariables.set("refreshToken", json.data.refreshToken);
  }
  ```
- **Sections not in the API** (Events, Admin, File Uploads, Notifications REST) are intentionally
  omitted from the collection because they have no endpoints — see §5/§15–17.

---

## Appendix — Endpoint Index

| # | Method | Path | Auth | Section |
|---|--------|------|------|---------|
| 1 | POST | `/api/auth/register` | No | Authentication |
| 2 | POST | `/api/auth/verify-otp` | No | Authentication |
| 3 | POST | `/api/auth/resend-otp` | No | Authentication |
| 4 | POST | `/api/auth/login` | No | Authentication |
| 5 | POST | `/api/auth/refresh` | No | Authentication |
| 6 | POST | `/api/auth/logout` | No | Authentication |
| 7 | GET | `/api/users/me` | Yes | Users |
| 8 | PATCH | `/api/users/me` | Yes | Users |
| 9 | GET | `/api/users/search?q=` | Yes | Users |
| 10 | GET | `/api/users/:id` | Yes | Users |
| 11 | POST | `/api/conversations` | Yes | Chats |
| 12 | GET | `/api/conversations` | Yes | Chats |
| 13 | GET | `/api/conversations/:id` | Yes | Chats |
| 14 | DELETE | `/api/conversations/:id` | Yes | Chats |
| 15 | POST | `/api/messages` | Yes | Messages |
| 16 | GET | `/api/messages/:conversationId` | Yes | Messages |
| 17 | PATCH | `/api/messages/:id/read` | Yes | Messages |
| 18 | POST | `/api/messages/:conversationId/read` | Yes | Messages |
| 19 | DELETE | `/api/messages/:id` | Yes | Messages |
| — | GET | `/health` | No | Health |
