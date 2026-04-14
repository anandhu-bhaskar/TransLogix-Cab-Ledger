/**
 * Rate limiters
 *
 * Three tiers:
 *   authLimiter   – login / signup: 10 attempts per 15 min per IP
 *   apiLimiter    – general API: 200 req per 15 min per IP
 *   strictLimiter – sensitive mutations: 30 req per 15 min per IP
 */

const rateLimit = require("express-rate-limit");

function jsonHandler(req, res) {
  res.status(429).json({
    error: "Too many requests. Please wait and try again."
  });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
  skipSuccessfulRequests: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler
});

module.exports = { authLimiter, apiLimiter, strictLimiter };
