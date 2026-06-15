import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redis from './src/config/redis.js';
import StatusCodes from './src/common/StatusCodes.js';
import errorHandler from './src/middleware/error.middleware.js';
import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
import conversationRoutes from './src/routes/conversation.routes.js';
import messageRoutes from './src/routes/message.routes.js';
import callRoutes from './src/routes/call.routes.js';
import notificationRoutes from './src/routes/notification.routes.js';
import statusRoutes from './src/routes/status.routes.js';
import uploadRoutes from './src/routes/upload.routes.js';
import adminRouter from './src/admin/index.js';
import { renderDocs } from './src/utils/docs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.join(__dirname, 'src', 'views');

const app = express();

app.use(helmet());
// app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Redis-backed rate limit on auth routes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later.', data: null },
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
});

app.get('/', (_req, res) => res.sendFile(path.join(VIEWS, 'HomeScreen.html')));
app.get('/health', (_req, res) => res.json({ success: true, message: 'ok', data: null }));
app.get(['/api-docs', '/api-document'], (_req, res) => res.type('html').send(renderDocs()));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRouter);

app.use((_req, res) =>
  res.status(StatusCodes.NOT_FOUND).sendFile(path.join(VIEWS, 'NotFound.html'))
);
app.use(errorHandler);

export default app;
