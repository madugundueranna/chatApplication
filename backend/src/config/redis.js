import Redis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Single shared client — cache reads/writes, presence, rate-limit store.
const redis = new Redis(url);

// Dedicated connections for the Socket.io Redis adapter (pub/sub mode).
export const pubClient = redis.duplicate();
export const subClient = redis.duplicate();

// BullMQ requires a connection configured for blocking commands.
export const bullConnection = new Redis(url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Attach a throttled, labelled error handler so connection problems are visible but never
// crash the process or flood the logs during reconnect storms.
export const attachErrorLogger = (client, label) => {
  let lastLoggedAt = 0;
  client.on('error', (err) => {
    const now = Date.now();
    if (now - lastLoggedAt < 5000) return;
    lastLoggedAt = now;
    console.error(`[redis:${label}] ${err.code || err.message}`);
  });
  return client;
};

attachErrorLogger(redis, 'main');
attachErrorLogger(pubClient, 'pub');
attachErrorLogger(subClient, 'sub');
attachErrorLogger(bullConnection, 'bull');

export default redis;
