/**
 * Call service
 *
 * Lifecycle helpers for 1-on-1 WebRTC calls plus TURN credential generation.
 * The server never touches media — it only persists call records, tracks live
 * routing/busy state in Redis, and hands clients time-limited ICE config.
 *
 *   - DB transitions (createCall / answerCall / declineCall / missCall / endCall)
 *     use conditional updates so concurrent accept / reject / ring-timeout /
 *     disconnect events race safely: whoever matches the expected status wins,
 *     everyone else gets `null` and no-ops.
 *   - Live state (callSession + activeCall) lives in Redis so signaling can be
 *     relayed and busy/multi-device checks answered without hitting Mongo on
 *     every ICE candidate, and so it works across clustered socket instances.
 */
import crypto from 'crypto';
import Call from '../models/Call.js';
import * as cache from './cache.service.js';
import { CALL_STATUS, CACHE_KEYS, CACHE_TTL } from '../common/Constants.js';
import createWithRetry from '../utils/createWithRetry.js';

// Unanswered calls auto-fail after this window (also drives the missed-call flow).
export const RING_TIMEOUT_MS = Number(process.env.CALL_RING_TIMEOUT_MS) || 35000;
// Throttle window for call:initiate (one new call attempt per user per N seconds).
export const INITIATE_THROTTLE_SECONDS = Number(process.env.CALL_INITIATE_THROTTLE_SECONDS) || 3;

const ACTIVE = { ringing: CALL_STATUS.RINGING, ongoing: CALL_STATUS.ONGOING };
const LIVE_STATUSES = [CALL_STATUS.RINGING, CALL_STATUS.ONGOING];

// ---- DB lifecycle --------------------------------------------------------

export const createCall = ({ callerId, calleeId, type, conversationId }) =>
  createWithRetry(
    Call,
    {
      type,
      caller: callerId,
      callee: calleeId,
      participants: [callerId, calleeId],
      conversation: conversationId || undefined,
      status: CALL_STATUS.RINGING,
      startedAt: new Date(),
    },
    'callId'
  );

// ringing -> ongoing (callee answered).
export const answerCall = (callId) =>
  Call.findOneAndUpdate(
    { callId, status: ACTIVE.ringing },
    { status: CALL_STATUS.ONGOING, answeredAt: new Date() },
    { new: true }
  );

// ringing -> declined (callee rejected before answering).
export const declineCall = (callId, byUserId) =>
  Call.findOneAndUpdate(
    { callId, status: ACTIVE.ringing },
    { status: CALL_STATUS.DECLINED, endedAt: new Date(), endedBy: byUserId, endReason: 'declined' },
    { new: true }
  );

// ringing -> missed (ring timeout fired with nobody answering).
export const missCall = (callId) =>
  Call.findOneAndUpdate(
    { callId, status: ACTIVE.ringing },
    { status: CALL_STATUS.MISSED, endedAt: new Date(), endReason: 'no-answer' },
    { new: true }
  );

// ringing|ongoing -> ended; durationSec is talk time (0 if never answered).
export const endCall = async (callId, byUserId, reason = 'hangup') => {
  const call = await Call.findOne({ callId, status: { $in: LIVE_STATUSES } });
  if (!call) return null;
  const endedAt = new Date();
  call.status = CALL_STATUS.ENDED;
  call.endedAt = endedAt;
  call.endedBy = byUserId;
  call.endReason = reason;
  call.durationSec = call.answeredAt ? Math.round((endedAt - call.answeredAt) / 1000) : 0;
  await call.save();
  return call;
};

// ---- Live session + busy state (Redis) ----------------------------------

export const setSession = (callId, data) =>
  cache.set(CACHE_KEYS.callSession(callId), data, CACHE_TTL.CALL_SESSION);

export const getSession = (callId) => cache.get(CACHE_KEYS.callSession(callId));

// Merge a patch into the live session; no-op if the session is already gone.
export const patchSession = async (callId, patch) => {
  const session = await getSession(callId);
  if (!session) return null;
  const next = { ...session, ...patch };
  await setSession(callId, next);
  return next;
};

export const setActiveCall = (userId, callId) =>
  cache.set(CACHE_KEYS.activeCall(String(userId)), callId, CACHE_TTL.CALL_SESSION);

export const getActiveCall = (userId) => cache.get(CACHE_KEYS.activeCall(String(userId)));

export const isBusy = async (userId) => (await getActiveCall(userId)) != null;

// Drop the session and every participant's busy pointer in one shot.
export const endSession = (callId, participantIds = []) =>
  cache.del(
    CACHE_KEYS.callSession(callId),
    ...participantIds.map((id) => CACHE_KEYS.activeCall(String(id)))
  );

// ---- TURN / STUN ---------------------------------------------------------

// Cache the managed provider's account-wide ICE config briefly so we don't hit
// their API on every call; well under the credentials' own validity window.
const ICE_CACHE_TTL = Number(process.env.METERED_CACHE_TTL_SECONDS) || 600;

const split = (val) => (val || '').split(',').map((s) => s.trim()).filter(Boolean);

const stunFallback = () => {
  const stun = split(process.env.STUN_URLS);
  return [{ urls: stun.length ? stun : ['stun:stun.l.google.com:19302'] }];
};

// Self-hosted coturn: short-lived HMAC credentials (TURN REST API scheme,
// username = `<expiry>:<userId>`), or static long-term creds as a fallback.
const selfHostedTurn = (userId) => {
  const turnUrls = split(process.env.TURN_URLS);
  if (!turnUrls.length) return [];
  const secret = process.env.TURN_STATIC_AUTH_SECRET;
  if (secret) {
    const ttl = Number(process.env.TURN_CRED_TTL_SECONDS) || 86400;
    const username = `${Math.floor(Date.now() / 1000) + ttl}:${userId}`;
    const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
    return [{ urls: turnUrls, username, credential }];
  }
  if (process.env.TURN_USERNAME && process.env.TURN_PASSWORD)
    return [{ urls: turnUrls, username: process.env.TURN_USERNAME, credential: process.env.TURN_PASSWORD }];
  return [];
};

// Managed TURN (Metered): fetch the account's ICE servers server-side so the API
// key never reaches the client. Returns Metered's iceServers array, or null when
// not configured. The response is shared across users and cached in Redis.
const meteredIceServers = () => {
  const apiKey = process.env.METERED_API_KEY;
  const domain = process.env.METERED_DOMAIN;
  if (!apiKey || !domain) return null;
  return cache.remember(CACHE_KEYS.iceServers, ICE_CACHE_TTL, async () => {
    const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`);
    if (!res.ok) throw new Error(`Metered TURN credentials request failed (${res.status})`);
    return res.json(); // array of { urls, username?, credential? }
  });
};

// Build the ICE config returned to clients. Managed provider takes precedence;
// if it's unconfigured or unreachable, fall back to self-hosted TURN + STUN.
export const generateIceServers = async (userId) => {
  try {
    const metered = await meteredIceServers();
    if (Array.isArray(metered) && metered.length) return { iceServers: metered };
  } catch {
    /* managed provider unreachable — fall back so calls still degrade gracefully */
  }
  return { iceServers: [...stunFallback(), ...selfHostedTurn(userId)] };
};
