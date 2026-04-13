const mongoose = require("mongoose");

const PaymentProofSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
    originalFilename: { type: String, trim: true },
    resourceType: { type: String, trim: true },
    format: { type: String, trim: true }
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    // The client whose balance is being settled
    payerName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    method: { type: String, enum: ["Bank Transfer", "Cash", "Revolut"], required: true },

    // direct = individual client, partner = business client
    linkedType: { type: String, enum: ["direct", "partner", "business", "individual"], required: true },
    businessClient: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessClient" },
    individualClient: { type: mongoose.Schema.Types.ObjectId, ref: "IndividualClient" },

    // Third-party payment: someone else paid on behalf of the client
    thirdPartyPayer: { type: Boolean, default: false },
    paidByName: { type: String, trim: true }, // actual person who transferred the money

    proof: PaymentProofSchema
  },
  { timestamps: true }
);

PaymentSchema.index({ date: -1 });

module.exports = mongoose.model("Payment", PaymentSchema);
