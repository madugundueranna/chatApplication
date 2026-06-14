// Cloudinary media storage. Status photos/videos are streamed straight from the
// upload buffer to Cloudinary; we keep the secure URL + public id (for deletion).
// Credentials come from the environment (CLOUDINARY_*) and never reach the client.
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload an in-memory buffer by piping it (via a Readable stream) into Cloudinary's
// upload_stream — no temp files. resourceType is 'image' | 'video' | 'raw' ('raw'
// for PDFs/other docs). Resolves the Cloudinary result ({ secure_url, public_id,
// bytes, duration, ... }).
export const uploadMedia = (buffer, { resourceType = 'image', folder = 'chatloop/status' } = {}) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

// A poster frame for a video, derived from its public id (first frame as JPG).
export const videoThumbnail = (publicId) =>
  cloudinary.url(publicId, {
    resource_type: 'video',
    format: 'jpg',
    transformation: [{ width: 480, crop: 'scale' }],
  });

// Best-effort delete of a stored asset.
export const deleteMedia = (publicId, resourceType = 'image') =>
  cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
