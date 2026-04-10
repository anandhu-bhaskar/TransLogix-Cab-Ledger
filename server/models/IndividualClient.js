const mongoose = require("mongoose");

const IndividualClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, trim: true },
    amountOwed: { type: Number, default: 0 },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" }
  },
  { timestamps: true }
);

IndividualClientSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model("IndividualClient", IndividualClientSchema);

