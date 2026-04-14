const express  = require("express");
const passport = require("passport");
const User     = require("../models/User");
const { authLimiter } = require("../middleware/rateLimits");
const { signupRules, loginRules } = require("../middleware/validate");
const { log }  = require("../middleware/securityLogger");

const router = express.Router();

// ── GET /auth/me ──────────────────────────────────────────────────────────
router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) return res.json({ user: null });
  const { _id, name, email, avatar } = req.user;
  res.json({ user: { _id, name, email, avatar } });
});

// ── POST /auth/signup ─────────────────────────────────────────────────────
router.post("/signup", authLimiter, ...signupRules, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      // Return the same message as "success" to prevent user enumeration
      return res.status(409).json({ error: "Unable to create account. Please check your details." });
    }

    const user = await User.create({ name, email, password });

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: "Login after signup failed." });
      const { _id, name: n, email: e, avatar } = user;
      log("AUTH_SIGNUP", { ip: req.ip, email: e });
      res.status(201).json({ user: { _id, name: n, email: e, avatar } });
    });
  } catch (e) {
    // Don't leak internal error details
    res.status(500).json({ error: "Account creation failed." });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────
router.post("/login", authLimiter, ...loginRules, async (req, res, next) => {
  const { email } = req.body;

  // Check account lock before Passport even runs
  const user = await User.findOne({ email }).catch(() => null);
  if (user && user.isLocked) {
    log("AUTH_FAIL", { ip: req.ip, email, reason: "account_locked" });
    return res.status(423).json({
      error: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes."
    });
  }

  passport.authenticate("local", async (err, authedUser, info) => {
    if (err) return next(err);

    if (!authedUser) {
      // Record the failure against the account if it exists
      if (user) {
        const nowLocked = await user.recordFailedLogin();
        if (nowLocked) {
          log("ACCOUNT_LOCK", { ip: req.ip, email });
        }
      }
      log("AUTH_FAIL", { ip: req.ip, email, reason: info?.message || "bad_credentials" });
      // Generic message — do not reveal whether the email exists
      return res.status(401).json({ error: "Invalid email or password." });
    }

    req.login(authedUser, async (loginErr) => {
      if (loginErr) return next(loginErr);
      await authedUser.resetLoginAttempts();
      log("AUTH_SUCCESS", { ip: req.ip, email: authedUser.email, userId: authedUser._id });
      const { _id, name, email: e, avatar } = authedUser;
      res.json({ user: { _id, name, email: e, avatar } });
    });
  })(req, res, next);
});

// ── POST /auth/logout ─────────────────────────────────────────────────────
router.post("/logout", (req, res, next) => {
  const userId = req.user?._id;
  req.logout((err) => {
    if (err) return next(err);
    // Destroy the session entirely — don't just unset the user
    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie("connect.sid", { path: "/" });
      log("AUTH_LOGOUT", { ip: req.ip, userId });
      res.json({ ok: true });
    });
  });
});

// ── Google OAuth ──────────────────────────────────────────────────────────
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/pages/login.html?error=google" }),
  (req, res) => {
    log("AUTH_SUCCESS", { ip: req.ip, email: req.user?.email, provider: "google" });
    res.redirect("/pages/index.html");
  }
);

module.exports = router;
