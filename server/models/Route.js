const mongoose = require("mongoose");

const RouteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    variants: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Route", RouteSchema);

