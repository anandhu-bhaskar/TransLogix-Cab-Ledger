/**
 * File upload security middleware
 *
 * Inspects uploaded files by reading their magic bytes (file signature)
 * rather than trusting the Content-Type header or file extension.
 *
 * Allowed types: JPEG, PNG, GIF, WebP, PDF
 * Max size: 5 MB (enforced here; also enforced by multer storage limit)
 */

const fileType = require("file-type");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf"
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Middleware: run after multer; validates the uploaded file's real MIME type.
 * Rejects the request if the file is present but unsafe.
 */
async function validateUploadedFile(req, res, next) {
  if (!req.file) return next(); // proof is optional

  // Size check (belt-and-suspenders — multer limits already set)
  if (req.file.size > MAX_FILE_SIZE) {
    return res.status(413).json({ error: "File too large. Maximum size is 5 MB." });
  }

  // Magic-byte MIME check
  // req.file.buffer is available when using memoryStorage; with cloudinary storage
  // the file is streamed and the buffer may not exist — so we fall back to
  // checking the mimetype reported by multer (which reads the Content-Type from the
  // multipart boundary) and the file extension simultaneously.
  if (req.file.buffer) {
    const detected = await fileType.fromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      return res.status(415).json({
        error: "Unsupported file type. Only JPEG, PNG, GIF, WebP, and PDF are allowed."
      });
    }
  } else {
    // Stream-based storage: validate declared MIME + extension
    const declaredMime = (req.file.mimetype || "").toLowerCase();
    const filename = (req.file.originalname || "").toLowerCase();
    const ext = filename.split(".").pop();
    const safeExts = new Set(["jpg", "jpeg", "png", "gif", "webp", "pdf"]);

    if (!ALLOWED_MIME_TYPES.has(declaredMime) || !safeExts.has(ext)) {
      return res.status(415).json({
        error: "Unsupported file type. Only JPEG, PNG, GIF, WebP, and PDF are allowed."
      });
    }
  }

  next();
}

module.exports = { validateUploadedFile };
