const express = require("express");
const Place   = require("../models/Place");
const { createPlaceRules } = require("../middleware/validate");

const router = express.Router();

const DEFAULTS = ["Coventry", "Oxford", "Birmingham", "London", "Leicester", "Stratford", "Warwick"];

router.get("/", async (req, res) => {
  const count = await Place.countDocuments();
  if (!count) {
    await Place.insertMany(DEFAULTS.map(name => ({ name })));
  }
  const places = await Place.find({}).sort({ name: 1 });
  res.json(places);
});

router.post("/", ...createPlaceRules, async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });
  const place = await Place.findOneAndUpdate(
    { name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
    { name },
    { upsert: true, new: true }
  );
  res.status(201).json(place);
});

module.exports = router;
