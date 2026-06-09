import mongoose from 'mongoose';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const parseLimit = (limit) => {
  const n = Number(limit) || DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(n, 1), MAX_PAGE_SIZE);
};

// Descending-_id cursor filter; returns {} when no/invalid cursor.
export const buildCursorFilter = (cursor) =>
  cursor && mongoose.isValidObjectId(cursor)
    ? { _id: { $lt: new mongoose.Types.ObjectId(cursor) } }
    : {};

// Split an over-fetched array (limit + 1 docs, sorted desc by _id) into a page + next cursor.
export const buildPage = (docs, limit) => {
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;
  return { items, nextCursor, hasMore };
};
