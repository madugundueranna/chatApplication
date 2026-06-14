import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import { uploadMessageFile } from '../middleware/messageUpload.middleware.js';
import { uploadFile } from '../controllers/upload.controller.js';

const router = Router();
router.use(authenticate);

// Standalone upload (multipart `file`) → { url, type, mimeType, size, originalName }.
router.post('/', uploadMessageFile, uploadFile);

export default router;
