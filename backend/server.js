import 'dotenv/config';
import http from 'http';
import app from './app.js';
import connectDB from './src/config/db.js';
import bootstrapAdmin from './src/admin/bootstrapAdmin.js';
import { initSocket } from './src/socket/index.js';
import { startNotificationWorker } from './src/queues/notification.queue.js';
import startCron from './src/config/cron.js';

const PORT = process.env.PORT || 5000;

// Transient outbound socket resets (Atlas/SMTP/Expo dropping idle TLS sockets)
// must never take the server down — log and keep serving. Anything else is a real
// bug, so we log it and exit rather than run in a corrupted state.
const TRANSIENT_NET_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

process.on('unhandledRejection', (reason) => {
  console.error(`Unhandled rejection: ${reason?.code || reason?.message || reason}`);
});

process.on('uncaughtException', (err) => {
  if (TRANSIENT_NET_CODES.has(err?.code)) {
    console.error(`Transient network error (ignored): ${err.code} on ${err.syscall || 'socket'}`);
    return;
  }
  console.error(`Uncaught exception: ${err?.stack || err?.message || err}`);
  process.exit(1);
});

const start = async () => {
  await connectDB();
  await bootstrapAdmin();
  const server = http.createServer(app);
  initSocket(server);
  startNotificationWorker();
  startCron();
  server.listen(PORT);
};

start().catch((err) => {
  console.error(`Startup failed: ${err.message}`);
  process.exit(1);
});
