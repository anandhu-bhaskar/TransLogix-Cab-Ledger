const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    sortCode: { type: String, trim: true },
    whatsappBusinessNumber: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", SettingsSchema);

