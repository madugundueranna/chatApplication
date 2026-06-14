import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

import connectDB from './config/db.js';
import User from './models/User.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';
import { CONVERSATION_TYPES, MESSAGE_TYPES } from './common/Constants.js';
import {
  generateUserId,
  generateConversationId,
  generateMessageId,
} from './utils/idGenerators.js';

// insertMany skips pre('save') and may skip pre('validate') depending on the
// Mongoose version, so assign the required readable ids explicitly. Each factory
// guarantees uniqueness within this run.
const uniqueIdFactory = (gen) => {
  const seen = new Set();
  return () => {
    let id;
    do {
      id = gen();
    } while (seen.has(id));
    seen.add(id);
    return id;
  };
};
const nextUserId = uniqueIdFactory(generateUserId);
const nextConversationId = uniqueIdFactory(generateConversationId);
const nextMessageId = uniqueIdFactory(generateMessageId);

// ---- Tunable seed counts -------------------------------------------------
const USERS = 30;
const CONVERSATIONS = 50; // at least 50
const DIRECT_RATIO = 0.7; // ~70% direct, ~30% group
const MIN_MSGS = 15;
const MAX_MSGS = 40;
const GROUP_MIN = 3;
const GROUP_MAX = 8;
const RECENT_UNREAD = 3; // newest N messages may be unread by some

const SHARED_PASSWORD = 'Password123!';
const OLDEST_DAYS = 60; // conversations start no older than this
const NEWEST_DAYS = 5; // ...and no newer than this (leaves room for msg timeline)

// Reproducible data run-to-run.
faker.seed(2024);

const pick = (arr) => faker.helpers.arrayElement(arr);
const distinct = (arr, min, max) =>
  faker.helpers.arrayElements(arr, { min, max });

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const buildUsers = async () => {
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  // Hash once and reuse — insertMany bypasses the pre-save hook.
  const passwordHash = await bcrypt.hash(SHARED_PASSWORD, rounds);

  return Array.from({ length: USERS }, (_, i) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    // Index suffix guarantees uniqueness even with name collisions.
    const email = `${faker.internet
      .username({ firstName, lastName })
      .toLowerCase()}.${i}@example.com`;

    return {
      userId: nextUserId(),
      name,
      email,
      password: passwordHash,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      isVerified: true,
      isOnline: faker.datatype.boolean(),
      lastSeen: faker.date.recent({ days: 7 }),
      refreshTokens: [],
    };
  });
};

const buildConversations = (users) => {
  const directCount = Math.round(CONVERSATIONS * DIRECT_RATIO);
  const groupCount = CONVERSATIONS - directCount;
  // Refs are stored as public ids now (USR-XXXXXX), not _id.
  const ids = users.map((u) => u.userId);
  const convs = [];

  // Direct: unique unordered pairs, no self-pairs, no duplicates.
  const seenPairs = new Set();
  let guard = 0;
  while (convs.filter((c) => c.type === CONVERSATION_TYPES.DIRECT).length < directCount) {
    if (guard++ > directCount * 50) break; // safety against pair exhaustion
    const [a, b] = distinct(ids, 2, 2);
    if (String(a) === String(b)) continue;
    const key = [String(a), String(b)].sort().join('|');
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);

    const createdAt = faker.date.between({ from: daysAgo(OLDEST_DAYS), to: daysAgo(NEWEST_DAYS) });
    convs.push({
      conversationId: nextConversationId(),
      type: CONVERSATION_TYPES.DIRECT,
      participants: [a, b],
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Group: 3–8 distinct participants, a name, and a creator from within.
  for (let i = 0; i < groupCount; i++) {
    const participants = distinct(ids, GROUP_MIN, GROUP_MAX);
    const createdAt = faker.date.between({ from: daysAgo(OLDEST_DAYS), to: daysAgo(NEWEST_DAYS) });
    convs.push({
      conversationId: nextConversationId(),
      type: CONVERSATION_TYPES.GROUP,
      participants,
      name: `${faker.word.adjective()} ${faker.helpers.arrayElement(['Team', 'Trip', 'Crew', 'Squad', 'Group', 'Project'])}`,
      createdBy: pick(participants),
      createdAt,
      updatedAt: createdAt,
    });
  }

  return convs;
};

const buildMessageContent = () => {
  const roll = faker.number.float({ min: 0, max: 1 });
  if (roll < 0.1) return { type: MESSAGE_TYPES.IMAGE, content: faker.image.url() };
  if (roll < 0.15)
    return {
      type: MESSAGE_TYPES.FILE,
      content: `${faker.system.commonFileName(faker.helpers.arrayElement(['pdf', 'docx', 'xlsx']))}`,
    };
  // Mostly text: a mix of short bursts and full sentences.
  const content = faker.datatype.boolean({ probability: 0.3 })
    ? faker.lorem.words({ min: 1, max: 4 })
    : faker.lorem.sentence({ min: 4, max: 14 });
  return { type: MESSAGE_TYPES.TEXT, content };
};

const buildMessages = (conversations) => {
  const docs = [];
  const lastIndexByConv = {}; // conversationId -> index of newest message in `docs`

  for (const conv of conversations) {
    const participants = conv.participants;
    const count = faker.number.int({ min: MIN_MSGS, max: MAX_MSGS });
    let stamp = conv.createdAt.getTime();

    for (let i = 0; i < count; i++) {
      // Advance time so messages are chronological within the conversation.
      stamp += faker.number.int({ min: 1, max: 120 }) * 60 * 1000;
      const createdAt = new Date(stamp);
      const sender = pick(participants);

      // Older messages are read by everyone; the newest few may be unread.
      const isRecent = i >= count - RECENT_UNREAD;
      let readBy;
      if (isRecent) {
        const others = participants.filter((p) => String(p) !== String(sender));
        readBy = [sender, ...distinct(others, 0, others.length)];
      } else {
        readBy = [...participants];
      }

      docs.push({
        messageId: nextMessageId(),
        conversation: conv.conversationId, // CVE-XXXXXX
        sender, // USR-XXXXXX
        ...buildMessageContent(),
        readBy, // USR-XXXXXX[]
        isDeleted: false,
        createdAt,
        updatedAt: createdAt,
      });
      lastIndexByConv[conv.conversationId] = docs.length - 1;
    }
  }

  return { docs, lastIndexByConv };
};

const run = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is "production". Aborting.');
    process.exit(1);
  }

  await connectDB();

  // Clean slate so re-runs are deterministic.
  await Promise.all([
    User.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
  ]);

  // Users (auto timestamps are fine here).
  const userDocs = await User.insertMany(await buildUsers());

  // Conversations carry explicit createdAt/updatedAt -> disable auto timestamps.
  const convDocs = await Conversation.insertMany(buildConversations(userDocs), {
    timestamps: false,
  });

  // Messages (large insert) — single insertMany, explicit timestamps.
  const { docs, lastIndexByConv } = buildMessages(convDocs);
  const messageDocs = await Message.insertMany(docs, { timestamps: false });

  // Point each conversation at its newest message and bump updatedAt to match.
  const ops = convDocs.map((conv) => {
    const newest = messageDocs[lastIndexByConv[conv.conversationId]];
    return {
      updateOne: {
        filter: { _id: conv._id },
        update: { $set: { lastMessage: newest.messageId, updatedAt: newest.createdAt } },
        timestamps: false,
      },
    };
  });
  await Conversation.bulkWrite(ops, { timestamps: false });

  console.log('\nSeed complete:');
  console.log(`  Users:         ${userDocs.length}`);
  console.log(`  Conversations: ${convDocs.length} (${convDocs.filter((c) => c.type === CONVERSATION_TYPES.DIRECT).length} direct, ${convDocs.filter((c) => c.type === CONVERSATION_TYPES.GROUP).length} group)`);
  console.log(`  Messages:      ${messageDocs.length}`);
  console.log('\nLog in as any seeded user:');
  console.log(`  email:    ${userDocs[0].email}`);
  console.log(`  password: ${SHARED_PASSWORD}`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
