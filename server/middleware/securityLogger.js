/**
 * Security event logger
 *
 * Writes structured security events to stdout (captured by Render / pm2 logs).
 * In production you'd pipe this to a SIEM or log aggregator.
 *
 * Events logged:
 *   - AUTH_FAIL      failed login attempt
 *   - AUTH_SUCCESS   successful login
 *   - ACCOUNT_LOCK   account locked after too many failures
 *   - RATE_LIMIT     IP hit a rate limit
 *   - INVALID_INPUT  validation rejection
 *   - FILE_REJECT    illegal file upload attempt
 *   - UNAUTHORISED   unauthenticated API access
 */

function log(event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...data
  };
  // Redact sensitive fields
  delete entry.password;
  delete entry.token;
  console.log("[SECURITY]", JSON.stringify(entry));
}

module.exports = { log };
