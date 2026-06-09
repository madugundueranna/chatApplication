import { Worker } from 'bullmq';
import { bullConnection, attachErrorLogger } from '../config/redis.js';
import { notificationQueue, QUEUE_NAMES } from './index.js';
import { sendOtpEmail, sendNewMessageEmail } from '../services/email.service.js';

export const JOBS = { OTP_EMAIL: 'otp-email', NEW_MESSAGE: 'new-message' };

// Producers — enqueue only, never await the heavy work.
export const enqueueOtpEmail = (email, code) => notificationQueue.add(JOBS.OTP_EMAIL, { email, code });

export const enqueueNewMessage = (payload) => notificationQueue.add(JOBS.NEW_MESSAGE, payload);

const processors = {
  [JOBS.OTP_EMAIL]: ({ email, code }) => sendOtpEmail(email, code),
  [JOBS.NEW_MESSAGE]: ({ recipients, senderName }) =>
    Promise.all(recipients.map((to) => sendNewMessageEmail(to, senderName))),
};

export const startNotificationWorker = () => {
  const connection = attachErrorLogger(bullConnection.duplicate(), 'worker');
  const worker = new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job) => {
      const processor = processors[job.name];
      if (processor) await processor(job.data);
    },
    { connection, concurrency: 10 }
  );
  worker.on('failed', (job, err) => console.error(`[worker:${job?.name}] ${err.message}`));
  return worker;
};
