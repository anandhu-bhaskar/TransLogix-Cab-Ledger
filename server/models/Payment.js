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
    payerName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    method: {
      type: String,
      enum: ["Revolut", "Bank Transfer", "Cash"],
      required: true
    },

    linkedType: { type: String, enum: ["business", "individual"], required: true },
    businessClient: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessClient" },
    individualClient: { type: mongoose.Schema.Types.ObjectId, ref: "IndividualClient" },

    proof: PaymentProofSchema
  },
  { timestamps: true }
);

PaymentSchema.index({ date: -1 });

module.exports = mongoose.model("Payment", PaymentSchema);

