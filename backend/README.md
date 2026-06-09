# Real-Time Chat Backend

Production-ready chat backend: Express + MongoDB (Mongoose) + Redis (ioredis) + Socket.io
(with the Redis adapter) + BullMQ. ES Modules throughout.

## Architecture

```
HTTP  → app.js → routes → middleware (auth, validate) → controllers → services / models
WS    → socket/index.js → socketAuth → handlers (message, presence, typing)
Async → BullMQ notifications queue + worker (OTP + offline-message emails)
Cache → Redis cache-aside (profiles, conversation lists), presence sets, typing throttle
```

- **Single shared Redis client** (`src/config/redis.js`) — reused by the cache, the
  Socket.io adapter (dedicated pub/sub duplicates), the rate limiter, and BullMQ.
- **One aggregation per list** (`src/common/Aggregations.js`) — conversation list joins
  `lastMessage` + the other participant and computes unread counts in a single round-trip.
- **Cursor pagination** (`src/utils/pagination.js`) — message history never uses `skip`.
- **Real-time delivery via per-user rooms** — every socket joins a room named after its
  `userId`; messages fan out only to the participants' rooms, never globally.

## Prerequisites

- Node.js >= 20 (developed/tested on Node 24)
- MongoDB (local or Atlas) — Redis **6.2+** recommended (BullMQ warns on older versions)
- Yarn (Classic, 1.x)

## Setup

```bash
yarn install                 # installs deps, writes yarn.lock
cp .env.example .env         # then edit values (Mongo URI, Redis URL, JWT secrets, SMTP)
```

Start the infrastructure (example, local):

```bash
# MongoDB and Redis must be reachable at the URLs in .env
redis-server
mongod
```

## Run

```bash
yarn dev      # node --watch server.js  (auto-restart on change)
yarn start    # node server.js          (production)
```

The server logs a single line on success: `Server running on port <PORT>`.
`GET /health` returns `{ "success": true, "message": "ok", "data": null }`.

## API summary

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/register` | name, email, password → enqueues OTP email |
| POST | `/api/auth/verify-otp` | email, code |
| POST | `/api/auth/resend-otp` | email |
| POST | `/api/auth/login` | → `{ accessToken, refreshToken, user }` |
| POST | `/api/auth/refresh` | refreshToken → new accessToken |
| POST | `/api/auth/logout` | refreshToken |
| GET  | `/api/users/me` | cache-aside profile |
| PATCH| `/api/users/me` | name / avatar (invalidates cache) |
| GET  | `/api/users/search?q=` | aggregation, excludes self |
| GET  | `/api/users/:id` | public profile |
| POST | `/api/conversations` | direct (deduped) or group |
| GET  | `/api/conversations` | cached aggregation w/ unread counts |
| GET  | `/api/conversations/:id` | participant-guarded |
| DELETE | `/api/conversations/:id` | leave/delete |
| POST | `/api/messages` | send (emits + enqueues offline notify) |
| GET  | `/api/messages/:conversationId?cursor=&limit=` | cursor history |
| PATCH| `/api/messages/:id/read` | single read receipt |
| POST | `/api/messages/:conversationId/read` | bulk read (`updateMany`) |
| DELETE | `/api/messages/:id` | soft delete (sender only) |

Protected routes require `Authorization: Bearer <accessToken>`.

## Socket.io

Authenticate on the handshake:

```js
import { io } from 'socket.io-client';
const socket = io(URL, { auth: { token: accessToken } });

socket.emit('message:send', { conversationId, content }, (ack) => {
  // ack = { success: true, message } — no re-fetch needed
});
socket.on('message:new', (msg) => { /* ... */ });
socket.on('message:read', (e) => { /* ... */ });
socket.on('typing:start', (e) => { /* ... */ });
socket.on('user:status', (e) => { /* { userId, isOnline, lastSeen? } */ });
```

## Production scaling

- Run one process per core under PM2 (or Node `cluster`):
  ```bash
  pm2 start server.js -i max --name chat-api
  ```
- Put the instances behind a load balancer with **sticky sessions**; the
  `@socket.io/redis-adapter` broadcasts events across all instances.
- Use a **MongoDB replica set** for read scaling.
- Store media on **S3 / Cloudinary + CDN** and persist only the URL (`message.content`
  with `type: image|file`) — never binary blobs in Mongo.
- Background fan-out (emails, push) runs in the BullMQ worker; scale workers independently.

## Cron jobs (`src/config/cron.js`)

- Every 10 minutes: clear expired OTPs.
- Daily 02:00: hard-delete messages soft-deleted more than 30 days ago.
