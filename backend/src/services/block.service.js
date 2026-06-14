import User from '../models/User.js';

/**
 * Block helpers. A "block relationship" exists if EITHER user has blocked the
 * other — used to stop messaging/conversation-creation and to hide presence.
 * All ids are public userIds (USR-XXXXXX). `blockedUsers` is select:false, so it
 * is fetched explicitly here.
 */

// True if `a` and `b` have a block relationship in either direction.
export const areBlocked = async (a, b) => {
  if (!a || !b || a === b) return false;
  const users = await User.find({ userId: { $in: [a, b] } })
    .select('userId blockedUsers')
    .lean();
  return users.some(
    (u) =>
      (u.userId === a && u.blockedUsers?.includes(b)) ||
      (u.userId === b && u.blockedUsers?.includes(a))
  );
};

// Of `otherIds`, return the Set that has a block relationship with `viewerId`
// (either direction). Used to hide online/last-seen in lists.
export const blockedRelationSet = async (viewerId, otherIds) => {
  const ids = [...new Set(otherIds)].filter((id) => id && id !== viewerId);
  if (!ids.length) return new Set();

  const viewer = await User.findOne({ userId: viewerId }).select('blockedUsers').lean();
  const blockedByViewer = new Set(viewer?.blockedUsers || []);

  // Users in `ids` who have blocked the viewer.
  const blockedViewer = await User.find({ userId: { $in: ids }, blockedUsers: viewerId })
    .select('userId')
    .lean();
  const blockedViewerSet = new Set(blockedViewer.map((u) => u.userId));

  return new Set(ids.filter((id) => blockedByViewer.has(id) || blockedViewerSet.has(id)));
};
