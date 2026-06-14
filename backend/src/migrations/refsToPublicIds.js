/**
 * One-time migration: convert every cross-model reference from a Mongo ObjectId
 * (the old design) to the target document's public id string (USR-/CVE-/MSG-).
 *
 *   Conversation : participants[] -> userId, createdBy -> userId, lastMessage -> messageId
 *   Message      : conversation -> conversationId, sender -> userId, readBy[] -> userId
 *   Call         : caller/callee/endedBy -> userId, participants[] -> userId, conversation -> conversationId
 *   Notification : recipient -> userId, sender -> userId
 *
 * Idempotent: values that are already public ids (or unresolvable) are left as-is,
 * so it is safe to re-run. Uses the native driver so raw ObjectId values are read
 * as ObjectIds (not cast to strings by the now-String schema).
 *
 * Run:  node src/migrations/refsToPublicIds.js
 * In production also set ALLOW_PROD_MIGRATION=true.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

const isObjectId = (v) => v instanceof mongoose.Types.ObjectId;
// A bare 24-hex string is an ObjectId that a prior schema-cast read turned into text.
const looksLikeObjectId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const needsMapping = (v) => isObjectId(v) || looksLikeObjectId(v);

// Resolve one ref value to its public id (or leave it untouched).
const mapOne = (val, map) => {
  if (val == null || !needsMapping(val)) return { changed: false, value: val };
  const mapped = map.get(String(val));
  return mapped ? { changed: true, value: mapped } : { changed: false, value: val };
};

// Resolve an array of ref values; changed=true if any element was rewritten.
const mapArray = (arr, map) => {
  if (!Array.isArray(arr)) return { changed: false, value: arr };
  let changed = false;
  const value = arr.map((v) => {
    const r = mapOne(v, map);
    if (r.changed) changed = true;
    return r.value;
  });
  return { changed, value };
};

const run = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_MIGRATION !== 'true') {
    console.error('Refusing to run in production without ALLOW_PROD_MIGRATION=true.');
    process.exit(1);
  }

  await connectDB();
  const db = mongoose.connection.db;
  const Users = db.collection('users');
  const Conversations = db.collection('conversations');
  const Messages = db.collection('messages');
  const Calls = db.collection('calls');
  const Notifications = db.collection('notifications');

  // _id(hex) -> public id lookup for each referenced collection.
  const buildMap = async (coll, field) => {
    const map = new Map();
    const cursor = coll.find({}, { projection: { [field]: 1 } });
    for await (const doc of cursor) if (doc[field]) map.set(String(doc._id), doc[field]);
    return map;
  };
  const [userMap, convMap, msgMap] = await Promise.all([
    buildMap(Users, 'userId'),
    buildMap(Conversations, 'conversationId'),
    buildMap(Messages, 'messageId'),
  ]);

  const counts = { conversations: 0, messages: 0, calls: 0, notifications: 0 };

  // Apply a per-document field plan and update only when something changed.
  const migrate = async (coll, label, plan) => {
    for await (const doc of coll.find({})) {
      const $set = {};
      for (const [field, kind, map] of plan) {
        const r = kind === 'array' ? mapArray(doc[field], map) : mapOne(doc[field], map);
        if (r.changed) $set[field] = r.value;
      }
      if (Object.keys($set).length) {
        await coll.updateOne({ _id: doc._id }, { $set });
        counts[label] += 1;
      }
    }
  };

  await migrate(Conversations, 'conversations', [
    ['participants', 'array', userMap],
    ['createdBy', 'one', userMap],
    ['lastMessage', 'one', msgMap],
  ]);
  await migrate(Messages, 'messages', [
    ['conversation', 'one', convMap],
    ['sender', 'one', userMap],
    ['readBy', 'array', userMap],
  ]);
  await migrate(Calls, 'calls', [
    ['caller', 'one', userMap],
    ['callee', 'one', userMap],
    ['participants', 'array', userMap],
    ['conversation', 'one', convMap],
    ['endedBy', 'one', userMap],
  ]);
  await migrate(Notifications, 'notifications', [
    ['recipient', 'one', userMap],
    ['sender', 'one', userMap],
  ]);

  console.log('Migration complete. Documents updated:', counts);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('Migration failed:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
