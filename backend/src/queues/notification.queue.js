import { Worker } from 'bullmq';
import { bullConnection, attachErrorLogger } from '../config/redis.js';
import { notificationQueue, QUEUE_NAMES } from './index.js';
import {
  sendOtpEmail,
  sendPasswordResetEmail,
  sendIncomingCallEmail,
  sendMissedCallEmail,
} from '../services/email.service.js';
import { sendPushToUser } from '../services/push.service.js';

export const JOBS = {
  OTP_EMAIL: 'otp-email',
  PASSWORD_RESET: 'password-reset',
  INCOMING_CALL: 'incoming-call',
  MISSED_CALL: 'missed-call',
  PUSH_NOTIFICATION: 'push-notification',
};

// Producers — enqueue only, never await the heavy work.
export const enqueueOtpEmail = (email, code) => notificationQueue.add(JOBS.OTP_EMAIL, { email, code });

export const enqueuePasswordResetEmail = (email, code) =>
  notificationQueue.add(JOBS.PASSWORD_RESET, { email, code });

export const enqueueIncomingCall = (payload) => notificationQueue.add(JOBS.INCOMING_CALL, payload);

export const enqueueMissedCall = (payload) => notificationQueue.add(JOBS.MISSED_CALL, payload);

// Deliver an Expo device push to one user (their registered tokens).
export const enqueuePushNotification = (payload) =>
  notificationQueue.add(JOBS.PUSH_NOTIFICATION, payload);

const processors = {
  [JOBS.OTP_EMAIL]: ({ email, code }) => sendOtpEmail(email, code),
  [JOBS.PASSWORD_RESET]: ({ email, code }) => sendPasswordResetEmail(email, code),
  [JOBS.INCOMING_CALL]: ({ email, callerName, type }) =>
    sendIncomingCallEmail(email, callerName, type),
  [JOBS.MISSED_CALL]: ({ email, callerName, type }) => sendMissedCallEmail(email, callerName, type),
  [JOBS.PUSH_NOTIFICATION]: ({ userId, title, body, data }) =>
    sendPushToUser(userId, { title, body, data }),
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
