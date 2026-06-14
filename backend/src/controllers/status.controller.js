import Status from '../models/Status.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import StatusCodes from '../common/StatusCodes.js';
import { sendSuccess } from '../common/Responses.js';
import { STATUS_TYPES, SOCKET_EVENTS } from '../common/Constants.js';
import { uploadMedia, deleteMedia, videoThumbnail } from '../services/cloudinary.service.js';
import { getIo } from '../socket/index.js';

// The set of userIds the current user shares a conversation with (their contacts).
// A status is visible only to its author's contacts (WhatsApp-style).
const contactIdsOf = async (userId) => {
  const convs = await Conversation.find({ participants: userId }).select('participants').lean();
  const set = new Set();
  for (const c of convs) for (const p of c.participants) set.add(String(p));
  set.delete(String(userId));
  return set;
};

// Public shape of one status. `mine` exposes the viewer count to the owner.
const shapeStatus = (s, meId, mine) => ({
  statusId: s.statusId,
  type: s.type,
  mediaUrl: s.mediaUrl || '',
  thumbnailUrl: s.thumbnailUrl || '',
  text: s.text || '',
  bgColor: s.bgColor || '#2563EB',
  caption: s.caption || '',
  duration: s.duration || 0,
  createdAt: s.createdAt,
  expiresAt: s.expiresAt,
  viewed: (s.viewers || []).includes(meId),
  ...(mine ? { viewersCount: (s.viewers || []).length } : {}),
});

// Real-time fan-out: tell the author's contacts a new story is up.
const emitStoryNew = async (ownerId, shaped) => {
  const io = getIo();
  const author = await User.findOne({ userId: ownerId }).select('userId name avatar').lean();
  const contacts = await contactIdsOf(ownerId);
  const payload = {
    status: shaped,
    author: author
      ? { userId: author.userId, name: author.name, avatar: author.avatar || '' }
      : { userId: ownerId },
  };
  for (const c of contacts) io.to(c).emit(SOCKET_EVENTS.STORY_NEW, payload);
};

// POST /api/status — a photo/video (multipart field `media`) OR a text story
// ({ text, bgColor } in the body), plus an optional caption.
export const createStatus = asyncHandler(async (req, res) => {
  const me = req.user.userId;
  let status;

  if (req.file) {
    const isVideo = req.file.mimetype.startsWith('video/');
    const result = await uploadMedia(req.file.buffer, {
      resourceType: isVideo ? 'video' : 'image',
    });
    status = await Status.create({
      user: me,
      type: isVideo ? STATUS_TYPES.VIDEO : STATUS_TYPES.IMAGE,
      mediaUrl: result.secure_url,
      thumbnailUrl: isVideo ? videoThumbnail(result.public_id) : result.secure_url,
      mediaPublicId: result.public_id,
      caption: req.body.caption?.trim() || '',
      duration: isVideo ? Math.round(result.duration || 0) : 0,
    });
  } else {
    // Text story — needs non-empty text.
    const text = (req.body.text || '').trim();
    if (!text) throw new ApiError(StatusCodes.BAD_REQUEST, 'A media file or text is required');
    status = await Status.create({
      user: me,
      type: STATUS_TYPES.TEXT,
      text,
      bgColor: req.body.bgColor || '#2563EB',
      caption: req.body.caption?.trim() || '',
    });
  }

  const shaped = shapeStatus(status.toObject(), me, true);
  emitStoryNew(me, shaped).catch(() => {}); // best-effort realtime
  return sendSuccess(res, StatusCodes.CREATED, 'Status posted', shaped);
});

// GET /api/status/feed — my contacts' (and my own) active statuses, grouped by user.
export const getStatusFeed = asyncHandler(async (req, res) => {
  const me = req.user.userId;
  const contacts = await contactIdsOf(me);
  const authors = [me, ...contacts];

  const docs = await Status.find({ user: { $in: authors }, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: 1 })
    .populate('author', 'userId name avatar')
    .lean();

  const groups = new Map();
  for (const s of docs) {
    if (!s.author) continue; // author account gone
    const mine = s.user === me;
    if (!groups.has(s.user)) {
      groups.set(s.user, {
        user: { userId: s.author.userId, name: s.author.name, avatar: s.author.avatar || '' },
        isMine: mine,
        statuses: [],
      });
    }
    groups.get(s.user).statuses.push(shapeStatus(s, me, mine));
  }

  const list = [...groups.values()].map((g) => ({
    ...g,
    lastCreatedAt: g.statuses[g.statuses.length - 1].createdAt,
    hasUnseen: g.isMine ? false : g.statuses.some((x) => !x.viewed),
  }));

  // Mine first, then groups with unseen items, then most recently updated.
  list.sort((a, b) => {
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return new Date(b.lastCreatedAt) - new Date(a.lastCreatedAt);
  });

  return sendSuccess(res, StatusCodes.OK, 'Status feed', list);
});

// GET /api/status/me — my own active statuses, each with its viewer count.
export const getMyStatuses = asyncHandler(async (req, res) => {
  const me = req.user.userId;
  const docs = await Status.find({ user: me, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: 1 })
    .lean();
  const statuses = docs.map((s) => shapeStatus(s, me, true));
  return sendSuccess(res, StatusCodes.OK, 'My status', { count: statuses.length, statuses });
});

// GET /api/status/user/:userId — one user's active statuses (for the viewer).
export const getUserStatuses = asyncHandler(async (req, res) => {
  const me = req.user.userId;
  const target = req.params.userId;
  const mine = target === me;

  if (!mine) {
    const contacts = await contactIdsOf(me);
    if (!contacts.has(target))
      throw new ApiError(StatusCodes.FORBIDDEN, 'You are not allowed to view this status');
  }

  const docs = await Status.find({ user: target, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: 1 })
    .populate('author', 'userId name avatar')
    .lean();
  if (!docs.length) throw new ApiError(StatusCodes.NOT_FOUND, 'No active status');

  const author = docs[0].author;
  return sendSuccess(res, StatusCodes.OK, 'User status', {
    user: { userId: author.userId, name: author.name, avatar: author.avatar || '' },
    isMine: mine,
    statuses: docs.map((s) => shapeStatus(s, me, mine)),
  });
});

// POST /api/status/:statusId/view — record that I've seen a status.
export const viewStatus = asyncHandler(async (req, res) => {
  const me = req.user.userId;
  const status = await Status.findOne({ statusId: req.params.statusId }).select(
    'statusId user viewers'
  );
  if (!status) throw new ApiError(StatusCodes.NOT_FOUND, 'Status not found');

  // Don't record the owner viewing their own status.
  if (status.user !== me && !status.viewers.includes(me)) {
    status.viewers.push(me);
    await status.save();
    // Live-update the owner's viewer count.
    try {
      getIo().to(status.user).emit(SOCKET_EVENTS.STORY_VIEWED, {
        statusId: status.statusId,
        viewerId: me,
        viewersCount: status.viewers.length,
      });
    } catch {
      /* socket optional */
    }
  }
  return sendSuccess(res, StatusCodes.OK, 'Viewed');
});

// GET /api/status/:statusId/viewers — owner-only list of who has seen it.
export const getStatusViewers = asyncHandler(async (req, res) => {
  const me = req.user.userId;
  const status = await Status.findOne({ statusId: req.params.statusId })
    .select('user viewers')
    .lean();
  if (!status) throw new ApiError(StatusCodes.NOT_FOUND, 'Status not found');
  if (status.user !== me)
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the owner can see viewers');

  const viewers = await User.find({ userId: { $in: status.viewers } })
    .select('-_id userId name avatar isOnline')
    .lean();
  return sendSuccess(res, StatusCodes.OK, 'Viewers', { count: viewers.length, viewers });
});

// DELETE /api/status/:statusId — owner removes their status (and its media).
export const deleteStatus = asyncHandler(async (req, res) => {
  const me = req.user.userId;
  const status = await Status.findOne({ statusId: req.params.statusId }).select(
    '+mediaPublicId user type'
  );
  if (!status) throw new ApiError(StatusCodes.NOT_FOUND, 'Status not found');
  if (status.user !== me)
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete your own status');

  try {
    await deleteMedia(status.mediaPublicId, status.type === STATUS_TYPES.VIDEO ? 'video' : 'image');
  } catch {
    /* best-effort; remove the record regardless */
  }
  await Status.deleteOne({ _id: status._id });
  return sendSuccess(res, StatusCodes.OK, 'Status deleted');
});
