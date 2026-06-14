import mongoose from 'mongoose';
import { CALL_TYPES, CALL_STATUS } from '../common/Constants.js';
import { generateCallId } from '../utils/idGenerators.js';
import hideObjectId from '../utils/hideObjectId.js';

const callSchema = new mongoose.Schema(
  {
    // Public-facing identifier (CAL-XXXXXX).
    callId: { type: String, required: true, unique: true, immutable: true },
    type: { type: String, enum: Object.values(CALL_TYPES), required: true },
    // References store the target's public id string, not its _id.
    caller: { type: String, required: true }, // USR-XXXXXX
    callee: { type: String, required: true }, // USR-XXXXXX
    // 1-on-1 today, but stored as an array so group calls can reuse this model.
    participants: { type: [String], required: true }, // USR-XXXXXX[]
    conversation: { type: String }, // CVE-XXXXXX
    status: {
      type: String,
      enum: Object.values(CALL_STATUS),
      default: CALL_STATUS.RINGING,
    },
    startedAt: { type: Date },
    answeredAt: { type: Date },
    endedAt: { type: Date },
    durationSec: { type: Number, default: 0 },
    endedBy: { type: String }, // USR-XXXXXX
    endReason: { type: String },
  },
  { timestamps: true }
);

// Call history is "my calls, newest first".
callSchema.index({ participants: 1, createdAt: -1 });

callSchema.pre('validate', function () {
  if (this.isNew && !this.callId) this.callId = generateCallId();
});

// Virtual populate: resolve string refs to their docs by public id.
callSchema.virtual('callerUser', {
  ref: 'User',
  localField: 'caller',
  foreignField: 'userId',
  justOne: true,
});
callSchema.virtual('calleeUser', {
  ref: 'User',
  localField: 'callee',
  foreignField: 'userId',
  justOne: true,
});
callSchema.virtual('participantUsers', {
  ref: 'User',
  localField: 'participants',
  foreignField: 'userId',
});
callSchema.virtual('endedByUser', {
  ref: 'User',
  localField: 'endedBy',
  foreignField: 'userId',
  justOne: true,
});
callSchema.virtual('conversationDoc', {
  ref: 'Conversation',
  localField: 'conversation',
  foreignField: 'conversationId',
  justOne: true,
});

hideObjectId(callSchema);

export default mongoose.model('Call', callSchema);
