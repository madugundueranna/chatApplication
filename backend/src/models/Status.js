import mongoose from 'mongoose';
import { STATUS_TYPES, STATUS_TTL_HOURS } from '../common/Constants.js';
import { generateStatusId } from '../utils/idGenerators.js';
import hideObjectId from '../utils/hideObjectId.js';

// Ephemeral status/story: a photo or short video that auto-expires after 24h.
const statusSchema = new mongoose.Schema(
  {
    // Public-facing identifier (STA-XXXXXX).
    statusId: { type: String, required: true, unique: true, immutable: true },
    user: { type: String, required: true }, // USR-XXXXXX (author)
    type: { type: String, enum: Object.values(STATUS_TYPES), required: true },
    // Media (image/video) — required for those types, absent for text stories.
    mediaUrl: { type: String, default: '' }, // Cloudinary secure_url
    thumbnailUrl: { type: String, default: '' }, // poster image (videos)
    // Cloudinary public id — kept private; used only to delete the asset.
    mediaPublicId: { type: String, default: '', select: false },
    // Text stories: the message + background colour of the card.
    text: { type: String, default: '', trim: true },
    bgColor: { type: String, default: '#2563EB' },
    caption: { type: String, default: '', trim: true },
    duration: { type: Number, default: 0 }, // seconds (videos)
    viewers: { type: [String], default: [] }, // USR-XXXXXX[] who have seen it
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: Mongo deletes the document once expiresAt passes.
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Feed query: a user's active statuses, oldest-first within the story.
statusSchema.index({ user: 1, createdAt: 1 });

statusSchema.pre('validate', function () {
  if (this.isNew && !this.statusId) this.statusId = generateStatusId();
  if (this.isNew && !this.expiresAt)
    this.expiresAt = new Date(Date.now() + STATUS_TTL_HOURS * 60 * 60 * 1000);
});

// Resolve the string ref to the author document by public id.
statusSchema.virtual('author', {
  ref: 'User',
  localField: 'user',
  foreignField: 'userId',
  justOne: true,
});

hideObjectId(statusSchema);

export default mongoose.model('Status', statusSchema);
