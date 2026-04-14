const express = require("express");
const Place = require("../models/Place");

const router = express.Router();

// Seed defaults on first load
const DEFAULTS = ["Coventry", "Oxford", "Birmingham", "London", "Leicester", "Stratford", "Warwick"];

router.get("/", async (req, res) => {
  // Seed defaults if collection is empty
  const count = await Place.countDocuments();
  if (!count) {
    await Place.insertMany(DEFAULTS.map(name => ({ name })));
  }
  const places = await Place.find({}).sort({ name: 1 });
  res.json(places);
});

router.post("/", async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });
  // Upsert — returns existing if already there
  const place = await Place.findOneAndUpdate(
    { name: { $regex: new RegExp(`^${name}$`, "i") } },
    { name },
    { upsert: true, new: true }
  );
  res.status(201).json(place);
});

module.exports = router;
