import 'dotenv/config';
import http from 'http';
import app from './app.js';
import connectDB from './src/config/db.js';
import { initSocket } from './src/socket/index.js';
import { startNotificationWorker } from './src/queues/notification.queue.js';
import startCron from './src/config/cron.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  startNotificationWorker();
  startCron();
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start().catch((err) => {
  console.error(`Startup failed: ${err.message}`);
  process.exit(1);
});
