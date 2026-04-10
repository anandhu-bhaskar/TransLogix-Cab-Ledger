const express = require("express");
const Worker = require("../models/Worker");

const router = express.Router();

router.get("/", async (req, res) => {
  const workers = await Worker.find({}).sort({ name: 1 });
  res.json(workers);
});

router.post("/", async (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  try {
    const worker = await Worker.create({ name: String(name).trim() });
    res.status(201).json(worker);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const deleted = await Worker.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

module.exports = router;

