import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { ROLES } from '../common/Constants.js';
import { generateUserId } from '../utils/idGenerators.js';
import hideObjectId from '../utils/hideObjectId.js';

const otpSchema = new mongoose.Schema(
  {
    code: { type: String },
    expiresAt: { type: Date },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // Public-facing identifier (USR-XXXXXX). Mongo's _id stays the internal PK.
    userId: { type: String, required: true, unique: true, immutable: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    // Authorization role; `admin` unlocks the /api/admin/* dashboard endpoints.
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    // Ban/suspend switch. Inactive accounts are blocked from logging in.
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date },
    otp: { type: otpSchema, select: false },
    refreshTokens: { type: [String], default: [], select: false },
    // Expo push tokens (ExponentPushToken[...]), one per registered device.
    pushTokens: { type: [String], default: [], select: false },
    // USR- ids this user has blocked. Hidden by default; fetched explicitly when
    // enforcing block rules and listed via GET /users/blocked.
    blockedUsers: { type: [String], default: [], select: false },
    // Admin-granted "verified account" badge (the blue tick). Distinct from
    // `isVerified`, which means the email/OTP was confirmed and gates login.
    isVerifiedAccount: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ name: 1, email: 1 });
// Admin list filtering (by role/active) and default newest-first sort.
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

userSchema.pre('validate', function () {
  if (this.isNew && !this.userId) this.userId = generateUserId();
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  this.password = await bcrypt.hash(this.password, rounds);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

hideObjectId(userSchema);

export default mongoose.model('User', userSchema);
