import jwt from 'jsonwebtoken';

// The access token carries the internal _id (used everywhere server-side) plus
// the readable userId (used when emitting public-facing payloads).
export const signAccessToken = (user) =>
  jwt.sign({ id: String(user._id), userId: user.userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });

export const signRefreshToken = (userId) =>
  jwt.sign({ id: String(userId) }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });

export const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET);
