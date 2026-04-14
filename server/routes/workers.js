const express = require("express");
const Worker  = require("../models/Worker");
const { body, validationResult } = require("express-validator");
const { mongoIdParam } = require("../middleware/validate");

const router = express.Router();

const workerRules = [
  body("name")
    .trim().notEmpty().withMessage("name is required")
    .isLength({ max: 100 }).withMessage("Name too long")
    .escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ error: errors.array()[0].msg });
    next();
  }
];

router.get("/", async (req, res) => {
  const workers = await Worker.find({}).sort({ name: 1 });
  res.json(workers);
});

router.post("/", ...workerRules, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
  try {
    const worker = await Worker.create({ name: String(name).trim() });
    res.status(201).json(worker);
  } catch (e) {
    res.status(400).json({ error: "Could not create worker." });
  }
});

router.delete("/:id", ...mongoIdParam("id"), async (req, res) => {
  const deleted = await Worker.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

module.exports = router;
