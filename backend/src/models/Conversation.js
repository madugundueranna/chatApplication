import mongoose from 'mongoose';
import { CONVERSATION_TYPES } from '../common/Constants.js';
import { generateConversationId } from '../utils/idGenerators.js';
import hideObjectId from '../utils/hideObjectId.js';

const conversationSchema = new mongoose.Schema(
  {
    // Public-facing identifier (CVE-XXXXXX).
    conversationId: { type: String, required: true, unique: true, immutable: true },
    type: {
      type: String,
      enum: Object.values(CONVERSATION_TYPES),
      default: CONVERSATION_TYPES.DIRECT,
    },
    // References store the target's public id string, not its _id.
    participants: { type: [String], required: true }, // USR-XXXXXX[]
    name: { type: String, trim: true },
    createdBy: { type: String }, // USR-XXXXXX
    lastMessage: { type: String }, // MSG-XXXXXX
    // Per-participant private state (WhatsApp-style): clear-chat cutoff + mute flag.
    // Each entry is scoped to one user and never affects the others.
    participantStates: {
      type: [
        new mongoose.Schema(
          {
            userId: { type: String, required: true }, // USR-XXXXXX
            clearedAt: { type: Date }, // hide messages at/older than this for this user
            muted: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

conversationSchema.pre('validate', function () {
  if (this.isNew && !this.conversationId) this.conversationId = generateConversationId();
});

// Virtual populate: resolve string refs to their docs by public id.
conversationSchema.virtual('participantUsers', {
  ref: 'User',
  localField: 'participants',
  foreignField: 'userId',
});
conversationSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: 'userId',
  justOne: true,
});
conversationSchema.virtual('lastMessageDoc', {
  ref: 'Message',
  localField: 'lastMessage',
  foreignField: 'messageId',
  justOne: true,
});

hideObjectId(conversationSchema);

export default mongoose.model('Conversation', conversationSchema);
