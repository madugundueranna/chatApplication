import { Queue } from 'bullmq';
import { bullConnection } from '../config/redis.js';

export const QUEUE_NAMES = { NOTIFICATIONS: 'notifications' };

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
