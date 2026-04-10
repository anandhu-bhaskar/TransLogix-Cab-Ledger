const express = require("express");
const Route = require("../models/Route");

const router = express.Router();

router.get("/", async (req, res) => {
  const routes = await Route.find({}).sort({ name: 1 });
  res.json(routes);
});

router.post("/", async (req, res) => {
  const { name, variants } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const cleanVariants = Array.isArray(variants)
    ? variants.map((v) => String(v).trim()).filter(Boolean)
    : [];

  try {
    const route = await Route.create({ name: String(name).trim(), variants: cleanVariants });
    res.status(201).json(route);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  const deleted = await Route.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

module.exports = router;

