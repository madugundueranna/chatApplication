import mongoose from 'mongoose';

const toId = (id) => new mongoose.Types.ObjectId(id);

// Unread = messages in this conversation not sent by me and not yet in my readBy.
const unreadCountStage = (userId) => ({
  $lookup: {
    from: 'messages',
    let: { convId: '$_id' },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ['$conversation', '$$convId'] },
              { $eq: ['$isDeleted', false] },
              { $ne: ['$sender', toId(userId)] },
              { $not: [{ $in: [toId(userId), '$readBy'] }] },
            ],
          },
        },
      },
      { $count: 'count' },
    ],
    as: 'unread',
  },
});

// The participant(s) of a conversation other than me, with public fields only.
const otherParticipantsStage = (userId) => ({
  $lookup: {
    from: 'users',
    let: { parts: '$participants' },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [{ $in: ['$_id', '$$parts'] }, { $ne: ['$_id', toId(userId)] }],
          },
        },
      },
      { $project: { _id: 0, userId: 1, name: 1, avatar: 1, isOnline: 1, lastSeen: 1 } },
    ],
    as: 'otherParticipants',
  },
});

export const conversationListPipeline = (userId) => [
  { $match: { participants: toId(userId) } },
  { $sort: { updatedAt: -1 } },
  {
    $lookup: {
      from: 'messages',
      localField: 'lastMessage',
      foreignField: '_id',
      as: 'lastMessage',
    },
  },
  { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
  // Resolve the last message's sender to its readable userId.
  {
    $lookup: {
      from: 'users',
      localField: 'lastMessage.sender',
      foreignField: '_id',
      as: 'lastMessageSender',
    },
  },
  { $unwind: { path: '$lastMessageSender', preserveNullAndEmptyArrays: true } },
  otherParticipantsStage(userId),
  unreadCountStage(userId),
  {
    $project: {
      _id: 0,
      conversationId: 1,
      type: 1,
      name: 1,
      updatedAt: 1,
      otherParticipants: 1,
      lastMessage: {
        $cond: [
          { $ifNull: ['$lastMessage._id', false] },
          {
            messageId: '$lastMessage.messageId',
            content: '$lastMessage.content',
            type: '$lastMessage.type',
            sender: '$lastMessageSender.userId',
            createdAt: '$lastMessage.createdAt',
          },
          null,
        ],
      },
      unreadCount: { $ifNull: [{ $arrayElemAt: ['$unread.count', 0] }, 0] },
    },
  },
];

export const userSearchPipeline = (q, meId, limit = 20) => [
  {
    $match: {
      _id: { $ne: toId(meId) },
      isVerified: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    },
  },
  { $project: { _id: 0, userId: 1, name: 1, avatar: 1, isOnline: 1 } },
  { $limit: limit },
];

export const conversationStatsPipeline = (conversationId, userId) => [
  { $match: { conversation: toId(conversationId), isDeleted: false } },
  {
    $group: {
      _id: '$conversation',
      total: { $sum: 1 },
      unread: {
        $sum: {
          $cond: [
            {
              $and: [
                { $ne: ['$sender', toId(userId)] },
                { $not: [{ $in: [toId(userId), '$readBy'] }] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
  },
];
