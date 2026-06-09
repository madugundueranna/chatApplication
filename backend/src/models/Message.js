import mongoose from 'mongoose';
import { MESSAGE_TYPES } from '../common/Constants.js';
import { generateMessageId } from '../utils/idGenerators.js';
import hideObjectId from '../utils/hideObjectId.js';

const messageSchema = new mongoose.Schema(
  {
    // Public-facing identifier (MSG-XXXXXX).
    messageId: { type: String, required: true, unique: true, immutable: true },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    type: { type: String, enum: Object.values(MESSAGE_TYPES), default: MESSAGE_TYPES.TEXT },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, readBy: 1 });

messageSchema.pre('validate', function () {
  if (this.isNew && !this.messageId) this.messageId = generateMessageId();
});

hideObjectId(messageSchema);

export default mongoose.model('Message', messageSchema);
