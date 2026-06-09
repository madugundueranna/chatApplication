import redis from '../config/redis.js';
import { CACHE_KEYS } from '../common/Constants.js';

export const get = async (key) => {
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
};

export const set = (key, value, ttl) =>
  ttl
    ? redis.set(key, JSON.stringify(value), 'EX', ttl)
    : redis.set(key, JSON.stringify(value));

export const del = (...keys) => (keys.length ? redis.del(keys) : Promise.resolve(0));

export const delByPattern = async (pattern) => {
  const stream = redis.scanStream({ match: pattern, count: 100 });
  const pipeline = redis.pipeline();
  let queued = 0;
  for await (const keys of stream) {
    keys.forEach((k) => {
      pipeline.del(k);
      queued += 1;
    });
  }
  if (queued) await pipeline.exec();
};

// Cache-aside: return cached value or fetch, store, and return it.
export const remember = async (key, ttl, fetchFn) => {
  const cached = await get(key);
  if (cached !== null) return cached;
  const fresh = await fetchFn();
  if (fresh !== null && fresh !== undefined) await set(key, fresh, ttl);
  return fresh;
};

// Acquire a short-lived throttle lock; true when acquired, false when still throttled.
export const throttle = async (key, seconds) =>
  (await redis.set(key, '1', 'EX', seconds, 'NX')) === 'OK';

// ---- Presence (online set + per-user socket set) ----

export const addOnline = (userId, socketId) =>
  redis
    .multi()
    .sadd(CACHE_KEYS.onlineUsers, String(userId))
    .sadd(CACHE_KEYS.userSockets(userId), socketId)
    .exec();

export const removeOnline = async (userId, socketId) => {
  await redis.srem(CACHE_KEYS.userSockets(userId), socketId);
  const remaining = await redis.scard(CACHE_KEYS.userSockets(userId));
  if (remaining === 0) await redis.srem(CACHE_KEYS.onlineUsers, String(userId));
  return remaining;
};

export const isOnline = async (userId) =>
  (await redis.sismember(CACHE_KEYS.onlineUsers, String(userId))) === 1;

// Return the subset of userIds that are currently offline.
export const filterOffline = async (userIds) => {
  if (!userIds.length) return [];
  const pipeline = redis.pipeline();
  userIds.forEach((id) => pipeline.sismember(CACHE_KEYS.onlineUsers, String(id)));
  const results = await pipeline.exec();
  return userIds.filter((_, i) => results[i][1] === 0);
};
