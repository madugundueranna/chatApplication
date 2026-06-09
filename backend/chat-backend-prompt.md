# Real-Time Chat Application — Backend Build Prompt (Production-Ready & Optimized)

> Copy everything below the line into your AI coding assistant. It is tuned to a fixed folder structure and tech stack, and enforces clean, minimal, DRY code with a complete performance, caching, and aggregation layer built in. **Package manager: Yarn (do not use npm).**

---

## ROLE

You are a **senior backend engineer**. Build a **production-ready, real-time chat application backend**. Write **clean, minimal, modular, DRY code**. Do **NOT** add dead code, unused imports, commented-out blocks, placeholder TODOs, or over-engineered abstractions. Every line must serve a purpose. Treat **performance, caching, and scalability as first-class requirements** — but implement them with **reusable helpers**, never by scattering ad-hoc logic across files.

## TECH STACK (use exactly this)

- **Package manager:** **Yarn** (use `yarn`, generate a `yarn.lock`; never use npm or produce a `package-lock.json`)
- **Runtime:** Node.js (ES Modules, `"type": "module"`)
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose
- **Cache / presence / pub-sub:** Redis via `ioredis` (single shared client)
- **Real-time:** Socket.io with `@socket.io/redis-adapter` (broadcasts across instances)
- **Background jobs / queues:** BullMQ (runs on Redis)
- **Auth:** JWT (access + refresh tokens), `bcrypt` for passwords
- **Email/OTP:** Nodemailer
- **Validation:** express-validator
- **Scheduling:** node-cron
- **Security:** helmet, cors, express-rate-limit (Redis-backed store)
- **Compression:** `compression` (gzip on HTTP responses)
- **Env:** dotenv

## EXACT FOLDER STRUCTURE (follow this precisely)

```
backend/
├── src/
│   ├── common/
│   │   ├── Aggregations.js     # reusable Mongo aggregation stages/builders
│   │   ├── Constants.js        # roles, message types, socket events, cache keys + TTLs
│   │   ├── Responses.js        # sendSuccess(), sendError() helpers
│   │   ├── StatusCodes.js      # HTTP status code constants
│   │   └── Validators.js       # reusable express-validator chains
│   ├── config/
│   │   ├── cron.js             # scheduled jobs (clean expired OTPs, etc.)
│   │   ├── db.js               # mongoose connection (with pool tuning)
│   │   └── redis.js            # shared ioredis client(s)
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── conversation.controller.js
│   │   ├── message.controller.js
│   │   └── user.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js  # verify JWT, attach req.user
│   │   ├── error.middleware.js # global error handler
│   │   └── validate.middleware.js # run validators, return 422 on fail
│   ├── models/
│   │   ├── Conversation.js
│   │   ├── Message.js
│   │   └── User.js
│   ├── queues/
│   │   ├── index.js            # BullMQ connection + queue registry
│   │   └── notification.queue.js # producer + worker (push/email fan-out)
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── conversation.routes.js
│   │   ├── message.routes.js
│   │   └── user.routes.js
│   ├── services/
│   │   ├── cache.service.js    # reusable cache-aside helpers (get/set/del, TTL, invalidate)
│   │   ├── email.service.js    # nodemailer transport + send helpers
│   │   ├── otp.service.js      # generate/verify OTP
│   │   └── token.service.js    # sign/verify access & refresh tokens
│   ├── socket/
│   │   ├── handlers/
│   │   │   ├── message.handler.js   # message:send -> message:new
│   │   │   ├── presence.handler.js  # online/offline + lastSeen (Redis-backed)
│   │   │   └── typing.handler.js    # typing:start / typing:stop (throttled)
│   │   ├── index.js            # init io, attach Redis adapter, register handlers
│   │   └── socketAuth.js       # JWT auth for socket handshake
│   ├── utils/
│   │   ├── ApiError.js         # custom error class
│   │   ├── asyncHandler.js     # wrap async controllers, forward errors
│   │   └── pagination.js       # reusable cursor-pagination helper
│   └── views/
│       ├── HomeScreen.html     # simple landing page
│       └── NotFound.html       # 404 page
├── app.js                      # express app, middleware, routes, views
└── server.js                   # http server + socket init + db + redis connect
```

---

## DATA MODELS

**User.js**
- `name` (String, required)
- `email` (String, required, unique, lowercase)
- `password` (String, required, bcrypt-hashed, `select: false`)
- `avatar` (String, default `''`)
- `isVerified` (Boolean, default false)
- `isOnline` (Boolean, default false)
- `lastSeen` (Date)
- `otp` { `code` (String), `expiresAt` (Date) } — cleared after verification
- `refreshTokens` ([String]) — multi-device logout
- `timestamps: true`
- **Indexes:** unique on `email`; index on `name` + `email` for search.
- Pre-save hook: hash password only when modified.
- Method: `comparePassword(plain)`.

**Conversation.js**
- `type` (enum `direct` | `group`, default `direct`)
- `participants` ([ObjectId → User], required)
- `name` (String, groups only)
- `createdBy` (ObjectId → User)
- `lastMessage` (ObjectId → Message) — denormalized for fast list loads
- `timestamps: true`
- **Indexes:** on `participants`; on `updatedAt` (sorted lists).

**Message.js**
- `conversation` (ObjectId → Conversation, required)
- `sender` (ObjectId → User, required)
- `content` (String, required)
- `type` (enum `text` | `image` | `file`, default `text`)
- `readBy` ([ObjectId → User])
- `isDeleted` (Boolean, default false)
- `timestamps: true`
- **Indexes:** compound `{ conversation: 1, createdAt: -1 }` (history + cursor paging); `{ conversation: 1, readBy: 1 }` (unread counts).

---

## REST API ENDPOINTS

All responses use the standardized `Responses.js` shape:
`{ success: boolean, message: string, data: object | null }`

### Auth (`/api/auth`)
- `POST /register` — name, email, password → create unverified user + send OTP email (**enqueue** the email, don't block the request).
- `POST /verify-otp` — email, code → verify, mark `isVerified`, clear OTP.
- `POST /resend-otp` — email → regenerate + resend OTP.
- `POST /login` — email, password → `{ accessToken, refreshToken, user }` (reject if unverified).
- `POST /refresh` — refreshToken → new accessToken.
- `POST /logout` — refreshToken → remove token from user.

### Users (`/api/users`) — all protected
- `GET /me` — current user profile (**cache-aside** in Redis; invalidate on update).
- `PATCH /me` — update name / avatar (invalidate cache).
- `GET /search?q=` — search by name/email, exclude self (indexed query or aggregation).
- `GET /:id` — public profile by id.

### Conversations (`/api/conversations`) — all protected
- `POST /` — create or fetch a `direct` conversation with a target user (no duplicates); create `group` with participants + name.
- `GET /` — list user's conversations via a **single aggregation pipeline**: join `lastMessage` + the other participant, compute **unread count per conversation**, sort by `updatedAt`. **Cache** the result per user (short TTL); invalidate on any new message in the user's conversations.
- `GET /:id` — details, participant-guarded.
- `DELETE /:id` — leave/delete conversation (invalidate cache).

### Messages (`/api/messages`) — all protected
- `POST /` — conversationId, content, type → save message, update `lastMessage`, invalidate affected conversation-list caches, emit `message:new` to participants, **enqueue a notification job** for offline participants.
- `GET /:conversationId?cursor=&limit=` — **cursor-based** paginated history (newest first), participant-guarded. Use `pagination.js`; never `skip/limit`.
- `PATCH /:id/read` — mark message read by current user.
- `POST /:conversationId/read` — mark many messages read in one **`bulkWrite` / `updateMany`**.
- `DELETE /:id` — soft-delete (sender only).

---

## SOCKET.IO (real-time)

- Authenticate every socket on handshake in `socketAuth.js` using the JWT (`socket.handshake.auth.token`). Reject invalid tokens. Attach `socket.user`.
- Attach the **Redis adapter** in `socket/index.js` so events broadcast correctly across multiple server instances.
- On connect: mark user online **in Redis** (online set + `userId → socketId` map), broadcast `user:status { userId, isOnline: true }`, join a room per `userId`.
- On disconnect: remove from Redis presence, set `lastSeen` in Mongo, broadcast `user:status { userId, isOnline: false, lastSeen }`.
- Emit to conversation participants via their **per-user rooms only** — never a global broadcast.
- `message:send` uses an **acknowledgement callback** returning the saved message (id + timestamp), so the client never re-fetches.
- **Throttle** `typing:start` server-side (emit at most once per user per ~2s).

**Events**

| Client emits   | Server emits to others | Handler             |
|----------------|------------------------|---------------------|
| `message:send` | `message:new`          | message.handler.js  |
| `message:read` | `message:read`         | message.handler.js  |
| `typing:start` | `typing:start`         | typing.handler.js   |
| `typing:stop`  | `typing:stop`          | typing.handler.js   |
| (connection)   | `user:status`          | presence.handler.js |

---

## PERFORMANCE & SCALABILITY (implement all, via reusable helpers)

### Caching — Redis (`cache.service.js`)
- Cache-aside helpers: `get`, `set(key, value, ttl)`, `del`, `delByPattern`, and a `remember(key, ttl, fetchFn)` wrapper.
- Cache **online presence** (online set + socket map) — hit on every connect/disconnect/status check.
- Cache **recent messages** of active conversations (last N).
- Cache **conversation lists** per user (short TTL) and the **`/me` profile**; invalidate on the matching write.
- Centralize all cache keys + TTLs in `Constants.js`. Never write raw `redis.*` calls inside controllers.

### MongoDB
- All indexes from the models section above.
- **Aggregation pipelines** (next section) for lists, search, and counts — one round-trip instead of N queries.
- **Cursor-based pagination** everywhere (via `utils/pagination.js`).
- `.lean()` + field **projection** on all read-only queries.
- **Denormalize** `lastMessage` onto the conversation.
- **`bulkWrite` / `updateMany`** for batch read-receipts.
- Tune the Mongoose **connection pool** in `db.js`.

### Real-time — Socket.io
- Per-user **rooms** for targeted delivery; `@socket.io/redis-adapter` for multi-instance.
- **Throttle** typing events; use **acks**; enable WebSocket `perMessageDeflate`.

### App layer — Express/Node
- `compression` (gzip) middleware; helmet; Redis-backed rate-limit on auth routes.
- Never block the event loop — everything `async/await`; offload heavy work to the queue/worker.
- Return **deltas** (only new messages since a cursor), not whole histories.

### Background jobs — BullMQ (`queues/`)
- A `notifications` queue + worker for fan-out: push notifications, emails, large-group delivery.
- Producers (controllers/handlers) only **enqueue** — they never `await` the heavy work.

### Scaling (document in run guide)
- Run under **PM2 / Node cluster** (one process per core).
- Load balancer with **sticky sessions** (the Redis adapter handles cross-instance broadcast).
- MongoDB **replica set** for read scaling; media on **S3 / Cloudinary + CDN** (store URLs only, never files in Mongo).

---

## MONGODB AGGREGATION (implement these, built from `common/Aggregations.js`)

1. **Conversation list with unread counts** — for the signed-in user: `$match` their conversations → `$lookup` last message and the other participant → compute **unread** as messages where `sender != me` and `me ∉ readBy` (`$lookup` sub-pipeline + `$size`) → `$project` a lean shape → `$sort` by `updatedAt`.
2. **User search** — `$match` name/email regex (case-insensitive) and `$ne` self → `$project` public fields (`_id, name, avatar, isOnline`) → `$limit`.
3. **Conversation message stats** (optional) — `$match` conversation → `$group` total + unread counts (for badges).

Reuse common stages (the "other participant" lookup, the "unread" sub-pipeline) from `Aggregations.js` — do **not** copy-paste pipeline stages between controllers.

---

## CRON JOBS (`config/cron.js`)
- Every 10 minutes: delete expired OTPs from users.
- Daily: optional cleanup of soft-deleted messages older than 30 days.

---

## CODE QUALITY RULES (strict — the most important section)

1. **Remove all unnecessary code.** No unused variables, imports, files, or functions. No commented-out code. No `console.log` except a single startup log in `server.js`.
2. **DRY.** Reuse `asyncHandler`, `ApiError`, `Responses`, `StatusCodes`, `Validators`, `cache.service`, `pagination`, and `Aggregations` everywhere. Never repeat response/error/cache/pagination/pipeline logic in controllers.
3. **Every controller** is wrapped in `asyncHandler` and throws `ApiError`; `error.middleware.js` formats failures.
4. **Validate every input** with express-validator chains in `Validators.js`, applied via `validate.middleware.js`. Return `422` with clear field errors.
5. **Security:** helmet, cors (configurable origin), Redis-backed rate-limit on auth routes; never return password or OTP.
6. **No business logic in routes** (wire middleware + controller only); **no logic in models** beyond hooks/methods.
7. **Services hold reusable logic** (cache, email, otp, token); controllers orchestrate.
8. **Caching is centralized** in `cache.service.js` with keys/TTLs in `Constants.js`; cache-aside on reads, explicit invalidation on writes.
9. **Pagination** (cursor) on all list endpoints; **indexes** on all frequently-queried fields; **aggregation** for joins/counts.
10. **Offload fan-out** (notifications, emails) to BullMQ — never block a request or socket handler on it.
11. Use a **single shared Redis client** from `config/redis.js`, reused by cache, socket adapter, rate-limit, and queues.
12. `async/await` only (no `.then` chains); handle all rejections.
13. Provide a complete **`.env.example`** and a clean **`package.json`** with only the dependencies actually used. Generate a **`yarn.lock`** (Yarn only — no `package-lock.json`).

---

## OUTPUT FORMAT

Generate the full project **file by file**, each in its own code block with the file path as a header. Build order:
`package.json` → `.env.example` → `config/db.js` → `config/redis.js` → models → `common/*` + `utils/*` → services → `queues/*` → middleware → controllers → routes → `socket/*` → `app.js` → `server.js`.

After the code, give a short **run guide** using **Yarn**:

- Install dependencies: `yarn`
- Start Redis + MongoDB (locally or via Docker).
- Copy env: `cp .env.example .env` and fill in values.
- Dev: `yarn dev` (nodemon).
- Production (PM2 / cluster, one process per core): `pm2 start server.js -i max --name chat-backend`.

Define scripts in `package.json` so they run via Yarn, e.g.:

```json
"scripts": {
  "dev": "nodemon server.js",
  "start": "node server.js"
}
```
