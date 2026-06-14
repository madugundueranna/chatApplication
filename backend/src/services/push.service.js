/**
 * Push service
 *
 * Delivers device push notifications through Expo's push service. We POST to the
 * Expo HTTP endpoint directly (no extra SDK dependency) — the same protocol the
 * `expo-server-sdk` wraps. Tokens look like `ExponentPushToken[xxxxxxxx]`.
 *
 * Invalid/stale tokens reported by Expo (`DeviceNotRegistered`) are pruned from
 * the user so we stop pushing to uninstalled apps. Sending is best-effort: a push
 * failure must never break the action that triggered it.
 */
import User from '../models/User.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

const isExpoPushToken = (token) => typeof token === 'string' && EXPO_TOKEN_RE.test(token);

// Expo accepts up to 100 messages per request.
const chunk = (arr, size = 100) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Send raw Expo push messages and return the flat array of per-message tickets.
const sendExpoPush = async (messages) => {
  if (!messages.length) return [];
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  const tickets = [];
  for (const batch of chunk(messages)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Expo push request failed (${res.status})`);
    const json = await res.json();
    if (Array.isArray(json?.data)) tickets.push(...json.data);
  }
  return tickets;
};

// Push to every device a user has registered. No-op when they have no tokens.
export const sendPushToUser = async (userId, { title, body, data = {} }) => {
  // userId is the public USR- id now, not a Mongo _id.
  const user = await User.findOne({ userId }).select('+pushTokens').lean();
  const tokens = (user?.pushTokens || []).filter(isExpoPushToken);
  if (!tokens.length) return;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high',
  }));

  const tickets = await sendExpoPush(messages);

  // Prune tokens Expo says are gone, so we stop trying on every future push.
  const dead = tickets
    .map((t, i) => (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered' ? tokens[i] : null))
    .filter(Boolean);
  if (dead.length) await User.updateOne({ userId }, { $pull: { pushTokens: { $in: dead } } });
};
