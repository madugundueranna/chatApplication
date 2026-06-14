import mongoose from 'mongoose';
import { REPORT_STATUS } from '../common/Constants.js';
import { generateReportId } from '../utils/idGenerators.js';
import hideObjectId from '../utils/hideObjectId.js';

const reportSchema = new mongoose.Schema(
  {
    // Public-facing identifier (REP-XXXXXX).
    reportId: { type: String, required: true, unique: true, immutable: true },
    // References store public ids (USR-XXXXXX), not Mongo _id.
    reporter: { type: String, required: true }, // who filed the report
    reported: { type: String, required: true }, // who is being reported
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(REPORT_STATUS),
      default: REPORT_STATUS.OPEN,
    },
  },
  { timestamps: true }
);

// Admin review queue: newest open reports first; lookups by the reported user.
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reported: 1 });

reportSchema.pre('validate', function () {
  if (this.isNew && !this.reportId) this.reportId = generateReportId();
});

// Virtual populate: resolve string refs to their user docs by public id.
reportSchema.virtual('reporterUser', {
  ref: 'User',
  localField: 'reporter',
  foreignField: 'userId',
  justOne: true,
});
reportSchema.virtual('reportedUser', {
  ref: 'User',
  localField: 'reported',
  foreignField: 'userId',
  justOne: true,
});

hideObjectId(reportSchema);

export default mongoose.model('Report', reportSchema);
