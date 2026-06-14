// Multer config for in-memory media uploads (status photos/videos). Files are held
// in memory and streamed on to Cloudinary, so nothing touches local disk.
import multer from 'multer';

const ALLOWED_MIME = [
  // images
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/webp',
  'image/gif',
  // videos
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/3gpp',
];

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) =>
    ALLOWED_MIME.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only image and video files are allowed')),
  limits: { fileSize: 1024 * 1024 * 50 }, // 50 MB
});

export default upload;
