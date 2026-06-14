# Chatloop — Mobile Chat App (Frontend)

A premium, sleek chat UI built with **Expo (SDK 56) · TypeScript · expo-router ·
NativeWind v4**. Frontend only: all data comes from `lib/api.ts`, which currently
returns mock data wrapped in Promises that mirror the real REST API. Swapping to the
live backend is a single-file change (see below).

## Run it

```bash
cd frontend
npm install        # if not already installed
npx expo start     # then press a (Android), i (iOS), or w (web)
```

The app starts on the **Login** screen (mock auth). Any email/password logs you in —
press **Login** to reach the Chats home. Register → OTP → verify also works (mock).

## Setup from scratch (commands)

Run these from the **parent folder** (the one that should contain `frontend/`).

```bash
# 1. Scaffold the Expo app (expo-router + TypeScript template)
npx --yes create-expo-app@latest frontend --template tabs
cd frontend

# 2. Install the extra dependencies
npx expo install nativewind react-native-gesture-handler expo-linear-gradient \
  @expo-google-fonts/inter expo-clipboard @expo/vector-icons
npm install -D tailwindcss@3.4.17

# 3. Verify / run
npx tsc --noEmit                                              # typecheck (expect 0 errors)
npx expo export --platform android --output-dir dist-check   # optional: validate the bundle
npx expo start                                               # run it (press a / i / w)
```

> **SDK 56 gotchas**
> - `@expo/vector-icons` is **not** bundled anymore — install it explicitly.
> - NativeWind v4 requires **Tailwind v3** — pin `tailwindcss@3.4.17` (do **not** let it
>   install Tailwind v4).

The commands above only scaffold the bare template + dependencies. The NativeWind config
files (`tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css`,
`nativewind-env.d.ts`, `app.d.ts`), the `lib/` data layer, and all `components/` + `app/`
screens are source files in this repo — copy them in (and delete the template's default
`app/(tabs)/`, `app/modal.tsx`, `app/+not-found.tsx`, `components/`, `constants/`).

To clone this finished project into another location instead:

```bash
robocopy frontend ..\newlocation\frontend /E /XD node_modules .expo dist dist-check
cd ..\newlocation\frontend
npm install
npx expo start
```

## Project structure

```
app/                       # expo-router (file-based routes)
  _layout.tsx              # root: global.css, Inter fonts, providers, Stack
  index.tsx                # redirect: logged in -> (tabs), else -> (auth)/login
  (auth)/                  # login · register · verify-otp
  (tabs)/                  # custom bottom nav: index (Chats) · profile
  chat/[id].tsx            # conversation (inverted list, typing, context menu)
  contact/[id].tsx         # contact detail
  new-chat.tsx             # start a direct chat (modal)
  new-group.tsx            # create a group (modal)
  edit-profile.tsx         # edit name / avatar (modal)
components/
  ui/                      # Button, Avatar, Badge, SearchBar, Chip, TextField,
                           # ScreenHeader, SectionHeader, EmptyState, Logo
  chat/                    # StoryList, ChatListItem, MessageBubble, MessageInput,
                           # TypingIndicator, MessageContextMenu
lib/
  types.ts                 # API-shaped TypeScript types
  api.ts                   # mock data-access layer (mirrors REST endpoints)
  utils.ts                 # formatTime, formatLastSeen, initials, previewText…
  constants.ts             # ME_ID (current user id)
  mock/                    # currentUser, users, conversations, messages
```

## Design tokens (tailwind.config.js)

`primary #2563EB` · `ink #0F172A` / `ink-secondary #64748B` / `ink-muted #94A3B8`
· `muted #F1F5F9` · `border #E2E8F0` · `online #22C55E` · `danger #EF4444`.
Font: **Inter** (Regular/Medium/SemiBold/Bold). Cards `rounded-3xl`, bubbles/inputs
`rounded-2xl`, buttons `rounded-full`.

## Going live (mock → real backend)

`lib/api.ts` functions map 1:1 to the documented backend
(`../backend/API_DOCUMENTATION.md`). To integrate, replace only the bodies of those
functions with `fetch` calls — no screen or component changes:

```ts
const API_BASE = "http://<host>:5000/api";
// e.g. login():
const res = await fetch(`${API_BASE}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const { data } = await res.json();           // { success, message, data }
// persist data.accessToken / data.refreshToken, then return { user: data.user }
```

Protected calls send `Authorization: Bearer <accessToken>`. For real-time, connect
Socket.io to the root origin with `{ auth: { token } }` and wire `message:new`,
`message:read`, `typing:*`, and `user:status` (see API doc §11). The UI-only fields
(`isPinned`, `isFavourite`, `bio`, `phone`, `location`) are optional and not returned
by the backend.
