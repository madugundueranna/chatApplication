// Detect a file's REAL type from its leading "magic bytes", so we never trust the
// client-declared mimetype or filename extension alone (those are trivially spoofed).
// Returns a canonical mime for the types we allow, or null if it's none of them.

export const detectMimeFromBuffer = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;

  // PDF: "%PDF"
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
    return 'application/pdf';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'image/png';

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';

  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return 'image/gif';

  // WEBP: "RIFF"...."WEBP"
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return 'image/webp';

  return null;
};

// Normalize the few aliases a browser/client might declare so a real-vs-declared
// comparison doesn't false-reject (e.g. "image/jpg" really means "image/jpeg").
export const normalizeMime = (mime) => (mime === 'image/jpg' ? 'image/jpeg' : mime);
