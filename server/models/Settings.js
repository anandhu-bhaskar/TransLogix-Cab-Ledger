const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema(
  {
    businessName: { type: String, trim: true },
    businessAddress: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    sortCode: { type: String, trim: true },
    whatsappBusinessNumber: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", SettingsSchema);

