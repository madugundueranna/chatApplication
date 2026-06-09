import mongoose from 'mongoose';
import { CONVERSATION_TYPES } from '../common/Constants.js';
import { generateConversationId } from '../utils/idGenerators.js';
import hideObjectId from '../utils/hideObjectId.js';

const conversationSchema = new mongoose.Schema(
  {
    // Public-facing identifier (CvE-XXXXXX).
    conversationId: { type: String, required: true, unique: true, immutable: true },
    type: {
      type: String,
      enum: Object.values(CONVERSATION_TYPES),
      default: CONVERSATION_TYPES.DIRECT,
    },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      required: true,
    },
    name: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

conversationSchema.pre('validate', function () {
  if (this.isNew && !this.conversationId) this.conversationId = generateConversationId();
});

hideObjectId(conversationSchema);

export default mongoose.model('Conversation', conversationSchema);
