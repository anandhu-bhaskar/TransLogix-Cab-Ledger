const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String }, // null for Google-only accounts
    googleId: { type: String },
    avatar: { type: String },

    // Per-user TextBee SMS integration
    smsEnabled: { type: Boolean, default: false },
    textbee: {
      apiKeyEnc: { type: String },   // AES-encrypted API key — never sent to frontend
      deviceId:  { type: String, trim: true }
    }
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.password || "");
};

module.exports = mongoose.model("User", userSchema);
