const express = require("express");
const BusinessClient = require("../models/BusinessClient");

const router = express.Router();

router.get("/", async (req, res) => {
  const clients = await BusinessClient.find({}).sort({ name: 1 });
  res.json(clients);
});

router.post("/", async (req, res) => {
  const { name, runningBalance } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
  const payload = { name: String(name).trim() };
  if (runningBalance !== undefined) payload.runningBalance = Number(runningBalance) || 0;

  try {
    const created = await BusinessClient.create(payload);
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id/balance", async (req, res) => {
  const { runningBalance } = req.body || {};
  const val = Number(runningBalance);
  if (!Number.isFinite(val)) return res.status(400).json({ error: "runningBalance must be a number" });

  const updated = await BusinessClient.findByIdAndUpdate(
    req.params.id,
    { $set: { runningBalance: val } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: "not found" });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const deleted = await BusinessClient.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

module.exports = router;

