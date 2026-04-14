const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS   = 15 * 60 * 1000; // 15 minutes

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, maxlength: 100 },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String }, // null for Google-only accounts
    googleId: { type: String },
    avatar:   { type: String },

    // ── Brute-force / account lockout ──────────────────────
    loginAttempts: { type: Number, default: 0 },
    lockUntil:     { type: Date }
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Virtual: is the account currently locked?
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Compare plaintext password against hash
userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.password || "");
};

/**
 * Record a failed login attempt.
 * Locks the account after MAX_LOGIN_ATTEMPTS failures.
 * Returns true if the account is now locked.
 */
userSchema.methods.recordFailedLogin = async function () {
  const updates = { $inc: { loginAttempts: 1 } };

  // If we've hit the max, set (or reset) the lockout window
  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION_MS) };
  }

  await this.constructor.findByIdAndUpdate(this._id, updates);
  return (this.loginAttempts + 1) >= MAX_LOGIN_ATTEMPTS;
};

/**
 * Reset failed login counter and lock after a successful login.
 */
userSchema.methods.resetLoginAttempts = async function () {
  await this.constructor.findByIdAndUpdate(this._id, {
    $set:   { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

module.exports = mongoose.model("User", userSchema);
