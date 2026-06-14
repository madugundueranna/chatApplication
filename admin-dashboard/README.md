# Chatloop — Admin Dashboard (Web)

A standalone **React + Vite** admin console for the chat application. It talks to
the existing backend admin API (`/api/admin/*`) and is a separate app from the
React Native mobile client.

## Stack

- React 18 + Vite
- React Router v6
- TanStack Query (server state, caching, pagination)
- axios with a token-refresh interceptor
- Tailwind CSS
- recharts (dashboard charts)
- react-hot-toast (feedback)

## Prerequisites

- The backend running (default `http://localhost:5000`) with the admin routes
  (`/api/admin/*`) and at least one user whose `role` is `admin`.
  The backend bootstraps the first admin from `ADMIN_EMAIL` — sign in with that
  account.

## Setup

```bash
cd admin-dashboard
yarn            # or: npm install
cp .env.example .env
```

By default `.env` leaves `VITE_API_BASE_URL` empty, so the app calls same-origin
`/api` and the Vite dev server **proxies** it to `VITE_PROXY_TARGET`
(`http://localhost:5000`). This means **no backend CORS changes are needed** for
local development.

To point at a deployed backend directly instead, set:

```
VITE_API_BASE_URL=https://api.yourdomain.com
```

…and make sure that backend's `CORS_ORIGIN` allows this dashboard's origin.

## Run

```bash
yarn dev        # http://localhost:5173
```

Build for production:

```bash
yarn build
yarn preview
```

## Project structure

```
src/
├── api/        # axios client (+ refresh) and service modules
├── auth/       # AuthProvider + ProtectedRoute (admin-only)
├── components/ # layout, DataTable, StatCard, ConfirmDialog, charts, primitives
├── lib/        # config, token storage, formatters, hooks
└── pages/      # Login, Dashboard, Users, Conversations, Messages
```

## Test order

1. Sign in as an admin (`ADMIN_EMAIL` account). A non-admin login is rejected
   with “This account is not an admin.” and no tokens are stored.
2. **Dashboard** — see the stat cards (users, online, conversations, messages)
   and the signups / messages-per-day charts.
3. **Users** — search/filter, then verify, promote/demote, ban/unban or delete a
   user (each behind a confirm dialog). The table refreshes on success.
4. **Conversations** — open “View messages” on a row, or delete a conversation.
5. **Messages** — filter by conversation or sender and delete (soft-delete) a
   message.
