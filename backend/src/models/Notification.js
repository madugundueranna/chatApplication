import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../common/Constants.js';
import { generateNotificationId } from '../utils/idGenerators.js';
import hideObjectId from '../utils/hideObjectId.js';

const notificationSchema = new mongoose.Schema(
  {
    // Public-facing identifier (NOT-XXXXXX).
    notificationId: { type: String, required: true, unique: true, immutable: true },
    // References store the target's public id string, not its _id.
    // Who the notification is for.
    recipient: { type: String, required: true }, // USR-XXXXXX
    // Who triggered it (sender of a message, caller, group creator); optional.
    sender: { type: String }, // USR-XXXXXX
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    // Free-form routing payload the client uses to deep-link (e.g. conversationId, callId).
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// List newest-first per recipient, and count unread cheaply.
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

notificationSchema.pre('validate', function () {
  if (this.isNew && !this.notificationId) this.notificationId = generateNotificationId();
});

// Virtual populate: resolve string refs to their docs by public id.
notificationSchema.virtual('recipientUser', {
  ref: 'User',
  localField: 'recipient',
  foreignField: 'userId',
  justOne: true,
});
notificationSchema.virtual('senderUser', {
  ref: 'User',
  localField: 'sender',
  foreignField: 'userId',
  justOne: true,
});

hideObjectId(notificationSchema);

export default mongoose.model('Notification', notificationSchema);
