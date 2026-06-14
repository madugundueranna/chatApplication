// Cross-model references are stored as public ids now (USR-/CVE-/MSG-), so every
// join below matches on the readable id field (userId/conversationId/messageId),
// not on Mongo's _id.

// Unread = messages in this conversation not sent by me and not yet in my readBy.
const unreadCountStage = (userId) => ({
  $lookup: {
    from: 'messages',
    let: { convId: '$conversationId' },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ['$conversation', '$$convId'] },
              { $eq: ['$isDeleted', false] },
              { $ne: ['$sender', userId] },
              { $not: [{ $in: [userId, '$readBy'] }] },
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
            $and: [{ $in: ['$userId', '$$parts'] }, { $ne: ['$userId', userId] }],
          },
        },
      },
      { $project: { _id: 0, userId: 1, name: 1, avatar: 1, isOnline: 1, lastSeen: 1 } },
    ],
    as: 'otherParticipants',
  },
});

export const conversationListPipeline = (userId) => [
  { $match: { participants: userId } },
  { $sort: { updatedAt: -1 } },
  {
    $lookup: {
      from: 'messages',
      localField: 'lastMessage', // MSG-XXXXXX
      foreignField: 'messageId',
      as: 'lastMessage',
    },
  },
  { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
  // Resolve the last message's sender (a userId) to its public preview fields.
  {
    $lookup: {
      from: 'users',
      localField: 'lastMessage.sender', // USR-XXXXXX
      foreignField: 'userId',
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
          { $ifNull: ['$lastMessage.messageId', false] },
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
      // This viewer's mute flag, read from their participantStates entry.
      muted: {
        $anyElementTrue: {
          $map: {
            input: { $ifNull: ['$participantStates', []] },
            as: 's',
            in: { $and: [{ $eq: ['$$s.userId', userId] }, { $eq: ['$$s.muted', true] }] },
          },
        },
      },
    },
  },
];

export const userSearchPipeline = (q, meId, limit = 20) => [
  {
    $match: {
      userId: { $ne: meId },
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
  { $match: { conversation: conversationId, isDeleted: false } },
  {
    $group: {
      _id: '$conversation',
      total: { $sum: 1 },
      unread: {
        $sum: {
          $cond: [
            {
              $and: [
                { $ne: ['$sender', userId] },
                { $not: [{ $in: [userId, '$readBy'] }] },
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
