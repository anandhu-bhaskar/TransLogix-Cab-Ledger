const mongoose = require("mongoose");

const PayerSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "IndividualClient", required: true },
    amount: { type: Number, required: true }
  },
  { _id: false }
);

const TripParticipantSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
    shareAmount: { type: Number, required: true }
  },
  { _id: false }
);

const TripSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },

    // Route — either a saved route or a custom name
    route: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    customRouteName: { type: String, trim: true },
    variant: { type: String, trim: true },

    // People physically on the trip
    workers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Worker" }],
    customWorkerNames: [{ type: String, trim: true }], // free-text "other" names
    unspecifiedWorkers: { type: Boolean, default: false },

    numberOfPeople: { type: Number },
    parkingCharges: { type: Number, default: 0 },
    otherExpenses: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    amountPerPerson: { type: Number },

    notes: { type: String, trim: true },

    // New payment model
    paymentMethod: { type: String, enum: ["direct", "partner"], required: true },

    // direct: individual clients who pay, with their share
    payers: [PayerSchema],

    // partner: a business client covers the full cost
    businessClient: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessClient" },

    // legacy fields kept for old data
    payerType: { type: String, enum: ["business", "individual"] },
    individualClient: { type: mongoose.Schema.Types.ObjectId, ref: "IndividualClient" },
    participants: [TripParticipantSchema]
  },
  { timestamps: true }
);

TripSchema.index({ date: -1 });

module.exports = mongoose.model("Trip", TripSchema);
