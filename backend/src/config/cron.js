import cron from 'node-cron';
import User from '../models/User.js';
import Message from '../models/Message.js';

const SOFT_DELETE_RETENTION_DAYS = 30;

const startCron = () => {
  // Every 10 minutes: clear expired OTPs.
  cron.schedule('*/10 * * * *', async () => {
    try {
      await User.updateMany({ 'otp.expiresAt': { $lt: new Date() } }, { $unset: { otp: '' } });
    } catch {
      /* retried on next tick */
    }
  });

  // Daily at 02:00: hard-delete messages soft-deleted over 30 days ago.
  cron.schedule('0 2 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await Message.deleteMany({ isDeleted: true, updatedAt: { $lt: cutoff } });
    } catch {
      /* retried next day */
    }
  });
};

export default startCron;
