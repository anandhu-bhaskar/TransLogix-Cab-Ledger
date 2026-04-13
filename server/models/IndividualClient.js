const mongoose = require("mongoose");

const IndividualClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, trim: true },
    postcode: { type: String, trim: true, default: "" },
    amountOwed: { type: Number, default: 0 },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },

    // Client type: direct payer or partner organisation
    clientType: { type: String, enum: ["direct", "partner"], default: "direct" },

    // Organisation they work at (free-text, no enum restriction)
    organisation: { type: String, trim: true, default: "" },

    // Only relevant when organisation = Carehome
    carehomeLocation: {
      type: String,
      enum: ["Oxford", "Coventry", "Stratford", ""],
      default: ""
    }
  },
  { timestamps: true }
);

IndividualClientSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model("IndividualClient", IndividualClientSchema);
