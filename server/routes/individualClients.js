const express = require("express");
const IndividualClient = require("../models/IndividualClient");
const { createClientRules, mongoIdParam } = require("../middleware/validate");

const router = express.Router();

router.get("/", async (req, res) => {
  const { status } = req.query;
  const q = {};
  if (status && ["unpaid", "paid"].includes(status)) q.status = status;
  const clients = await IndividualClient.find(q).sort({ status: 1, name: 1 });
  res.json(clients);
});

router.post("/", ...createClientRules, async (req, res) => {
  const { name, whatsappNumber, postcode, clientType, organisation, carehomeLocation } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });

  try {
    const created = await IndividualClient.create({
      name: String(name).trim(),
      whatsappNumber: whatsappNumber ? String(whatsappNumber).trim() : "",
      postcode: postcode ? String(postcode).trim().toUpperCase() : "",
      clientType: clientType || "direct",
      organisation: organisation || "",
      carehomeLocation: organisation === "Carehome" ? (carehomeLocation || "") : ""
    });
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: "Could not create client." });
  }
});

router.put("/:id/status", ...mongoIdParam("id"), async (req, res) => {
  const { status } = req.body || {};
  if (!["unpaid", "paid"].includes(status)) {
    return res.status(400).json({ error: "status must be unpaid or paid" });
  }

  const update = { status };
  if (status === "paid") update.amountOwed = 0;

  const updated = await IndividualClient.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: "not found" });
  res.json(updated);
});

router.delete("/:id", ...mongoIdParam("id"), async (req, res) => {
  const deleted = await IndividualClient.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

module.exports = router;
