import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
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
    isVerified: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date },
    otp: { type: otpSchema, select: false },
    refreshTokens: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

userSchema.index({ name: 1, email: 1 });

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
