/**
 * Call controller
 *
 * Read-only REST surface for calls:
 *   - getCallHistory : cursor-paginated list of the caller's calls.
 *   - getCall        : one call's details (participants only).
 *   - getIceServers  : STUN/TURN config with short-lived credentials.
 *
 * Records are written by the signaling layer (socket/handlers/call.handler.js);
 * these endpoints only serve history and ICE config. Lean reads are serialized
 * by hand (lean skips the schema's _id-stripping transform) so responses expose
 * readable ids only.
 */
import Call from '../models/Call.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { parseLimit, buildCursorFilter, buildPage } from '../utils/pagination.js';
import { generateIceServers } from '../services/call.service.js';

const pickUser = (user) => (user ? { userId: user.userId, name: user.name, avatar: user.avatar } : null);

const serializeCall = (call) => ({
  callId: call.callId,
  type: call.type,
  status: call.status,
  caller: pickUser(call.callerUser),
  callee: pickUser(call.calleeUser),
  // conversation and endedBy are stored as public ids now — no lookup needed.
  conversationId: call.conversation ?? null,
  startedAt: call.startedAt,
  answeredAt: call.answeredAt,
  endedAt: call.endedAt,
  durationSec: call.durationSec,
  endReason: call.endReason ?? null,
  endedBy: call.endedBy ?? null,
  createdAt: call.createdAt,
});

// Virtual-populate only the refs that need a name/avatar (caller + callee).
const populateCall = (query) =>
  query
    .populate('callerUser', 'userId name avatar')
    .populate('calleeUser', 'userId name avatar');

export const getCallHistory = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const docs = await populateCall(
    Call.find({ participants: req.user.userId, ...buildCursorFilter(req.query.cursor) })
      .sort({ _id: -1 })
      .limit(limit + 1)
  ).lean();

  const { items, nextCursor } = buildPage(docs, limit);
  return sendSuccess(res, StatusCodes.OK, 'Calls fetched', {
    items: items.map(serializeCall),
    nextCursor,
  });
});

export const getCall = asyncHandler(async (req, res) => {
  const call = await populateCall(Call.findOne({ callId: req.params.callId })).lean();
  if (!call) throw new ApiError(StatusCodes.NOT_FOUND, 'Call not found');

  const isParticipant = call.participants.some((p) => p === req.user.userId);
  if (!isParticipant) throw new ApiError(StatusCodes.FORBIDDEN, 'Not a call participant');

  return sendSuccess(res, StatusCodes.OK, 'Call fetched', serializeCall(call));
});

export const getIceServers = asyncHandler(async (req, res) =>
  sendSuccess(res, StatusCodes.OK, 'ICE servers', await generateIceServers(req.user.userId))
);
