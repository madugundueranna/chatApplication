/**
 * Call signaling handler
 *
 * Relays WebRTC signaling (SDP offers/answers, ICE candidates) and drives the
 * call lifecycle over the existing authenticated socket. Media never touches the
 * server — only signaling and bookkeeping do.
 *
 * Routing uses the per-call Redis session (caller/callee user ids + their active
 * socket ids), so signaling is point-to-point between the two live endpoints and
 * works across clustered socket instances via the Redis adapter. Every event is
 * guarded by callId ownership (sender must be the call's caller or callee).
 *
 * Multi-device: call:incoming rings all of the callee's sockets; the first to
 * accept wins and the rest are dismissed. Disconnect of an active endpoint ends
 * the call; disconnect of an idle, still-ringing device does not.
 */
import User from '../../models/User.js';
import Conversation from '../../models/Conversation.js';
import * as callService from '../../services/call.service.js';
import * as cache from '../../services/cache.service.js';
import { enqueueIncomingCall, enqueueMissedCall } from '../../queues/notification.queue.js';
import { notify, pushToUser } from '../../services/notification.service.js';
import { SOCKET_EVENTS, CALL_TYPES, CACHE_KEYS, NOTIFICATION_TYPES } from '../../common/Constants.js';

const USER_ID_RE = /^USR-[A-Z0-9]{6}$/;
const CALL_ID_RE = /^CAL-[A-Z0-9]{6}$/;
const CONV_ID_RE = /^CVE-[A-Z0-9]{6}$/;

const {
  DISCONNECT,
  CALL_INITIATE,
  CALL_INCOMING,
  CALL_ACCEPT,
  CALL_ACCEPTED,
  CALL_REJECT,
  CALL_REJECTED,
  CALL_OFFER,
  CALL_ANSWER,
  CALL_ICE_CANDIDATE,
  CALL_ICE_SERVERS,
  CALL_END,
  CALL_ENDED,
  CALL_MISSED,
  CALL_BUSY,
  CALL_ERROR,
} = SOCKET_EVENTS;

// In-process ring timers, keyed by callId. The timeout only marks a call missed
// if it is still ringing (callService.missCall is conditional), so a timer that
// fires after an accept/end on another instance is a harmless no-op — clearing
// it here is just a local optimisation, not a correctness requirement.
const ringTimers = new Map();

const clearRingTimer = (callId) => {
  const timer = ringTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    ringTimers.delete(callId);
  }
};

const peerOf = (session, me) => (me === session.callerId ? session.calleeId : session.callerId);
const peerSocketOf = (session, me) =>
  me === session.callerId ? session.calleeSocketId : session.callerSocketId;

// Report a failed event back via ack when present, else as a call:error emit.
const fail = (socket, ack, message) => {
  if (typeof ack === 'function') ack({ success: false, error: message });
  else socket.emit(CALL_ERROR, { message });
};

// Optionally link the call to a conversation; ignored if the id is unknown.
const resolveConversationId = async (conversationId) => {
  if (!CONV_ID_RE.test(conversationId || '')) return undefined;
  const conv = await Conversation.findOne({ conversationId }).select('conversationId').lean();
  return conv?.conversationId; // Call.conversation stores the readable CVE- id
};

const onRingTimeout = async (io, callId) => {
  ringTimers.delete(callId);
  try {
    const call = await callService.missCall(callId);
    if (!call) return; // answered, declined or ended in the meantime
    const session = await callService.getSession(callId);
    await callService.endSession(callId, [call.caller, call.callee]);

    if (session?.callerSocketId) io.to(session.callerSocketId).emit(CALL_MISSED, { callId });
    io.to(call.callee).emit(CALL_MISSED, { callId }); // dismiss the ring everywhere

    const [callee, caller] = await Promise.all([
      User.findOne({ userId: call.callee }).select('email').lean(),
      User.findOne({ userId: call.caller }).select('userId name avatar').lean(),
    ]);
    const callerName = caller?.name || 'Someone';
    if (callee?.email)
      await enqueueMissedCall({ email: callee.email, callerName, type: call.type });

    await notify({
      recipientId: call.callee,
      type: NOTIFICATION_TYPES.CALL_MISSED,
      title: 'Missed call',
      body: `You missed a ${call.type} call from ${callerName}`,
      data: { callId, callType: call.type },
      sender: caller
        ? { id: call.caller, userId: caller.userId, name: caller.name, avatar: caller.avatar }
        : null,
    });
  } catch {
    /* missed-call cleanup is best-effort */
  }
};

const registerCallHandlers = (io, socket) => {
  const me = socket.user.userId; // public id: rooms, ownership, refs

  const scheduleRingTimer = (callId) => {
    clearRingTimer(callId);
    const timer = setTimeout(() => onRingTimeout(io, callId), callService.RING_TIMEOUT_MS);
    if (timer.unref) timer.unref();
    ringTimers.set(callId, timer);
  };

  // Relay a signaling payload to the other endpoint's specific socket.
  const relayToPeer = async (callId, event, payload, ack) => {
    if (!CALL_ID_RE.test(callId || '')) return fail(socket, ack, 'A valid callId is required');
    const session = await callService.getSession(callId);
    if (!session) return fail(socket, ack, 'Call is not active');
    if (me !== session.callerId && me !== session.calleeId)
      return fail(socket, ack, 'Not authorized for this call');
    const target = peerSocketOf(session, me);
    if (!target) return fail(socket, ack, 'Peer is not connected yet');
    io.to(target).emit(event, { callId, ...payload });
    if (typeof ack === 'function') ack({ success: true });
  };

  socket.on(CALL_INITIATE, async (data, ack) => {
    try {
      const calleePublicId = data?.calleeId;
      const type = data?.type;
      if (!USER_ID_RE.test(calleePublicId || ''))
        return fail(socket, ack, 'A valid calleeId is required');
      if (!Object.values(CALL_TYPES).includes(type))
        return fail(socket, ack, 'type must be audio or video');
      if (!(await cache.throttle(CACHE_KEYS.callInitiateThrottle(me), callService.INITIATE_THROTTLE_SECONDS)))
        return fail(socket, ack, 'Too many call attempts, slow down');

      const callee = await User.findOne({ userId: calleePublicId }).select('userId name email').lean();
      if (!callee) return fail(socket, ack, 'Callee not found');
      const calleeId = callee.userId;
      if (calleeId === me) return fail(socket, ack, 'You cannot call yourself');

      if (await callService.isBusy(me)) return fail(socket, ack, 'You are already in a call');
      if (await callService.isBusy(calleeId)) {
        socket.emit(CALL_BUSY, { calleeId: calleePublicId });
        if (typeof ack === 'function') ack({ success: false, error: 'Callee is busy', busy: true });
        return;
      }

      const conversation = await resolveConversationId(data?.conversationId);
      const call = await callService.createCall({ callerId: me, calleeId, type, conversationId: conversation });

      await Promise.all([
        callService.setActiveCall(me, call.callId),
        callService.setActiveCall(calleeId, call.callId),
        callService.setSession(call.callId, {
          callId: call.callId,
          callerId: me,
          calleeId,
          type,
          callerSocketId: socket.id,
          calleeSocketId: null,
        }),
      ]);

      const caller = await User.findOne({ userId: me }).select('userId name avatar').lean();
      io.to(calleeId).emit(CALL_INCOMING, {
        callId: call.callId,
        type,
        caller: { userId: caller?.userId, name: caller?.name, avatar: caller?.avatar },
      });

      // Ring offline/backgrounded devices that aren't holding a live socket.
      if (!(await cache.isOnline(calleeId))) {
        const callerName = caller?.name || 'Someone';
        if (callee.email) await enqueueIncomingCall({ email: callee.email, callerName, type });
        // Transient by nature — push only, no persisted bell entry (a missed call
        // gets its own entry if it goes unanswered).
        await pushToUser(calleeId, {
          title: 'Incoming call',
          body: `${callerName} is calling you (${type})`,
          data: { type: NOTIFICATION_TYPES.CALL_INCOMING, callId: call.callId, callType: type },
        });
      }

      scheduleRingTimer(call.callId);
      if (typeof ack === 'function') ack({ success: true, callId: call.callId });
    } catch {
      fail(socket, ack, 'Failed to start call');
    }
  });

  socket.on(CALL_ACCEPT, async ({ callId } = {}, ack) => {
    try {
      if (!CALL_ID_RE.test(callId || '')) return fail(socket, ack, 'A valid callId is required');
      const session = await callService.getSession(callId);
      if (!session) return fail(socket, ack, 'Call is no longer available');
      if (me !== session.calleeId) return fail(socket, ack, 'Not authorized for this call');

      const call = await callService.answerCall(callId);
      if (!call) return fail(socket, ack, 'Call is no longer available');

      clearRingTimer(callId);
      await callService.patchSession(callId, { calleeSocketId: socket.id });

      if (session.callerSocketId) io.to(session.callerSocketId).emit(CALL_ACCEPTED, { callId });
      // First-to-accept wins: dismiss the ring on the callee's other devices.
      socket.to(session.calleeId).emit(CALL_ENDED, { callId, reason: 'answered-elsewhere' });
      if (typeof ack === 'function') ack({ success: true, callId });
    } catch {
      fail(socket, ack, 'Failed to accept call');
    }
  });

  socket.on(CALL_REJECT, async ({ callId } = {}, ack) => {
    try {
      if (!CALL_ID_RE.test(callId || '')) return fail(socket, ack, 'A valid callId is required');
      const session = await callService.getSession(callId);
      if (!session) return fail(socket, ack, 'Call is no longer available');
      if (me !== session.calleeId) return fail(socket, ack, 'Not authorized for this call');

      const call = await callService.declineCall(callId, socket.user.userId);
      if (!call) return fail(socket, ack, 'Call is no longer available');

      clearRingTimer(callId);
      await callService.endSession(callId, [session.callerId, session.calleeId]);
      if (session.callerSocketId) io.to(session.callerSocketId).emit(CALL_REJECTED, { callId });
      socket.to(session.calleeId).emit(CALL_ENDED, { callId, reason: 'declined-elsewhere' });
      if (typeof ack === 'function') ack({ success: true });
    } catch {
      fail(socket, ack, 'Failed to reject call');
    }
  });

  socket.on(CALL_END, async ({ callId } = {}, ack) => {
    try {
      if (!CALL_ID_RE.test(callId || '')) return fail(socket, ack, 'A valid callId is required');
      const session = await callService.getSession(callId);
      if (!session) {
        if (typeof ack === 'function') ack({ success: true }); // already ended — idempotent
        return;
      }
      if (me !== session.callerId && me !== session.calleeId)
        return fail(socket, ack, 'Not authorized for this call');

      const reason = me === session.callerId ? 'caller-hangup' : 'callee-hangup';
      const call = await callService.endCall(callId, socket.user.userId, reason);
      clearRingTimer(callId);
      await callService.endSession(callId, [session.callerId, session.calleeId]);
      io.to(peerOf(session, me)).emit(CALL_ENDED, {
        callId,
        durationSec: call?.durationSec ?? 0,
        reason: call?.endReason ?? reason,
      });
      if (typeof ack === 'function') ack({ success: true, durationSec: call?.durationSec ?? 0 });
    } catch {
      fail(socket, ack, 'Failed to end call');
    }
  });

  socket.on(CALL_OFFER, ({ callId, sdp } = {}, ack) => {
    if (!sdp) return fail(socket, ack, 'sdp is required');
    return relayToPeer(callId, CALL_OFFER, { sdp }, ack);
  });

  socket.on(CALL_ANSWER, ({ callId, sdp } = {}, ack) => {
    if (!sdp) return fail(socket, ack, 'sdp is required');
    return relayToPeer(callId, CALL_ANSWER, { sdp }, ack);
  });

  socket.on(CALL_ICE_CANDIDATE, ({ callId, candidate } = {}, ack) => {
    if (!candidate) return fail(socket, ack, 'candidate is required');
    return relayToPeer(callId, CALL_ICE_CANDIDATE, { candidate }, ack);
  });

  socket.on(CALL_ICE_SERVERS, async (_data, ack) => {
    if (typeof ack !== 'function') return;
    const { iceServers } = await callService.generateIceServers(socket.user.userId);
    ack({ success: true, iceServers });
  });

  socket.on(DISCONNECT, async () => {
    try {
      const callId = await callService.getActiveCall(me);
      if (!callId) return;
      const session = await callService.getSession(callId);
      if (!session) return;
      // Only tear down when the dropped socket is the call's live endpoint;
      // an idle, still-ringing device dropping must not kill the call.
      if (session.callerSocketId !== socket.id && session.calleeSocketId !== socket.id) return;

      const call = await callService.endCall(callId, socket.user.userId, 'disconnected');
      clearRingTimer(callId);
      await callService.endSession(callId, [session.callerId, session.calleeId]);
      io.to(peerOf(session, me)).emit(CALL_ENDED, {
        callId,
        reason: 'peer-disconnected',
        durationSec: call?.durationSec ?? 0,
      });
    } catch {
      /* disconnect cleanup is best-effort */
    }
  });
};

export default registerCallHandlers;
