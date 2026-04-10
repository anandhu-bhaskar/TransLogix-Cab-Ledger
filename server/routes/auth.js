const express = require("express");
const passport = require("passport");
const User = require("../models/User");

const router = express.Router();

// GET current session user
router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) return res.json({ user: null });
  const { _id, name, email, avatar } = req.user;
  res.json({ user: { _id, name, email, avatar } });
});

// POST /auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email and password are required." });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "An account with that email already exists." });

    const user = await User.create({ name, email, password });

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: "Login after signup failed." });
      const { _id, name, email, avatar } = user;
      res.status(201).json({ user: { _id, name, email, avatar } });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /auth/login
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || "Invalid credentials." });
    req.login(user, (err) => {
      if (err) return next(err);
      const { _id, name, email, avatar } = user;
      res.json({ user: { _id, name, email, avatar } });
    });
  })(req, res, next);
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  req.logout(() => {
    res.json({ ok: true });
  });
});

// GET /auth/google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// GET /auth/google/callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/pages/login.html?error=google" }),
  (req, res) => {
    res.redirect("/pages/index.html");
  }
);

module.exports = router;
