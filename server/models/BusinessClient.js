const mongoose = require("mongoose");

const BusinessClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    runningBalance: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("BusinessClient", BusinessClientSchema);

