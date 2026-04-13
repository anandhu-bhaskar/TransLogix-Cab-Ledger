const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";

// Derive a 32-byte key from the app secret. Add ENCRYPTION_SECRET to .env for
// a dedicated key; falls back to SESSION_SECRET so no extra config is needed.
function getKey() {
  const secret = process.env.ENCRYPTION_SECRET || process.env.SESSION_SECRET || "fallback-dev-secret-change-me";
  return crypto.scryptSync(secret, "textbee-salt", 32);
}

function encrypt(plaintext) {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(ciphertext) {
  if (!ciphertext) return "";
  const [ivHex, encHex] = ciphertext.split(":");
  if (!ivHex || !encHex) return "";
  try {
    const iv = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

module.exports = { encrypt, decrypt };
