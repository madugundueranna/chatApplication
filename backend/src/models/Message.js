import mongoose from 'mongoose';
import { MESSAGE_TYPES } from '../common/Constants.js';
import { generateMessageId } from '../utils/idGenerators.js';
import hideObjectId from '../utils/hideObjectId.js';

// File/image attachment metadata (for type === image | file). `content` holds the
// stored media URL; this carries the original name, real mime type, size and an
// optional caption. Absent on plain text messages.
const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    caption: { type: String },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    // Public-facing identifier (MSG-XXXXXX).
    messageId: { type: String, required: true, unique: true, immutable: true },
    // References store the target's public id string, not its _id.
    conversation: { type: String, required: true }, // CVE-XXXXXX
    sender: { type: String, required: true }, // USR-XXXXXX
    content: { type: String, required: true }, // text, or the media URL for image/file
    type: { type: String, enum: Object.values(MESSAGE_TYPES), default: MESSAGE_TYPES.TEXT },
    attachment: { type: attachmentSchema, default: undefined },
    readBy: { type: [String], default: [] }, // USR-XXXXXX[]
    isDeleted: { type: Boolean, default: false }, // deleted "for everyone"
    // USR- ids who deleted this message "for me" — hidden from their history only.
    deletedFor: { type: [String], default: [] },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, readBy: 1 });

messageSchema.pre('validate', function () {
  if (this.isNew && !this.messageId) this.messageId = generateMessageId();
});

// Virtual populate: resolve string refs to their docs by public id.
messageSchema.virtual('senderUser', {
  ref: 'User',
  localField: 'sender',
  foreignField: 'userId',
  justOne: true,
});
messageSchema.virtual('conversationDoc', {
  ref: 'Conversation',
  localField: 'conversation',
  foreignField: 'conversationId',
  justOne: true,
});
messageSchema.virtual('readers', {
  ref: 'User',
  localField: 'readBy',
  foreignField: 'userId',
});

hideObjectId(messageSchema);

export default mongoose.model('Message', messageSchema);
