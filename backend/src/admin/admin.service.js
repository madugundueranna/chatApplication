import { CONVERSATION_TYPES, ROLES } from '../common/Constants.js';

// Admin dashboard aggregations. Each `$facet` gathers every scalar for one
// collection plus its time-series in a single round-trip; the controller reads
// counts via facetCount() and runs the three facets in parallel (one per
// collection). Cross-model refs are stored as public ids (USR-/CVE-/MSG-), so the
// joins below match on the readable id fields, not Mongo's _id.

// Group a date field into YYYY-MM-DD buckets for the dashboard time-series.
const dayBucket = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field } });

export const userStatsFacet = (since) => [
  {
    $facet: {
      total: [{ $count: 'c' }],
      verified: [{ $match: { isVerified: true } }, { $count: 'c' }],
      admins: [{ $match: { role: ROLES.ADMIN } }, { $count: 'c' }],
      signupsPerDay: [
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: dayBucket('$createdAt'), count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
    },
  },
];

export const conversationStatsFacet = () => [
  {
    $facet: {
      total: [{ $count: 'c' }],
      direct: [{ $match: { type: CONVERSATION_TYPES.DIRECT } }, { $count: 'c' }],
      group: [{ $match: { type: CONVERSATION_TYPES.GROUP } }, { $count: 'c' }],
    },
  },
];

export const messageStatsFacet = ({ startOfToday, startOfWeek, since }) => [
  { $match: { isDeleted: false } },
  {
    $facet: {
      total: [{ $count: 'c' }],
      today: [{ $match: { createdAt: { $gte: startOfToday } } }, { $count: 'c' }],
      week: [{ $match: { createdAt: { $gte: startOfWeek } } }, { $count: 'c' }],
      perDay: [
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: dayBucket('$createdAt'), count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
    },
  },
];

// Paginated moderation list of every conversation with participant previews,
// message count and last activity. Newest activity first.
export const adminConversationsPipeline = ({ skip, limit }) => [
  { $sort: { updatedAt: -1 } },
  { $skip: skip },
  { $limit: limit },
  {
    $lookup: {
      from: 'users',
      let: { parts: '$participants' },
      pipeline: [
        { $match: { $expr: { $in: ['$userId', '$$parts'] } } },
        { $project: { _id: 0, userId: 1, name: 1, avatar: 1 } },
      ],
      as: 'participants',
    },
  },
  {
    $lookup: {
      from: 'messages',
      let: { convId: '$conversationId' },
      pipeline: [
        { $match: { $expr: { $eq: ['$conversation', '$$convId'] } } },
        { $count: 'count' },
      ],
      as: 'messageCount',
    },
  },
  {
    $project: {
      _id: 0,
      conversationId: 1,
      type: 1,
      name: 1,
      participants: 1,
      createdAt: 1,
      updatedAt: 1,
      messageCount: { $ifNull: [{ $arrayElemAt: ['$messageCount.count', 0] }, 0] },
    },
  },
];
