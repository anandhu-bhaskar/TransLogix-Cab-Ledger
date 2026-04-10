const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const Payment = require("../models/Payment");
const BusinessClient = require("../models/BusinessClient");
const IndividualClient = require("../models/IndividualClient");

cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === "application/pdf";
    return {
      folder: "transport-billing/proofs",
      resource_type: isPdf ? "raw" : "image",
      public_id: undefined
    };
  }
});

const upload = multer({ storage });

const router = express.Router();

router.get("/", async (req, res) => {
  const payments = await Payment.find({})
    .sort({ date: -1 })
    .populate("businessClient")
    .populate("individualClient");
  res.json(payments);
});

router.post("/", upload.single("proof"), async (req, res) => {
  const { payerName, amount, date, method, linkedType, businessClientId, individualClientId } = req.body || {};

  if (!payerName || !String(payerName).trim()) return res.status(400).json({ error: "payerName is required" });
  const amt = Number(amount);
  if (!Number.isFinite(amt)) return res.status(400).json({ error: "amount must be a number" });
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "valid date is required" });
  if (!["Revolut", "Bank Transfer", "Cash"].includes(method)) {
    return res.status(400).json({ error: "method must be Revolut, Bank Transfer, or Cash" });
  }
  if (!["business", "individual"].includes(linkedType)) {
    return res.status(400).json({ error: "linkedType must be business or individual" });
  }

  const payload = {
    payerName: String(payerName).trim(),
    amount: amt,
    date: d,
    method,
    linkedType
  };

  if (req.file) {
    payload.proof = {
      url: req.file.path,
      publicId: req.file.filename,
      originalFilename: req.file.originalname,
      resourceType: req.file.resource_type,
      format: req.file.format
    };
  }

  if (linkedType === "business") {
    if (!businessClientId) return res.status(400).json({ error: "businessClientId is required" });
    const bc = await BusinessClient.findById(businessClientId);
    if (!bc) return res.status(400).json({ error: "invalid businessClientId" });
    payload.businessClient = bc._id;
  } else {
    if (!individualClientId) return res.status(400).json({ error: "individualClientId is required" });
    const ic = await IndividualClient.findById(individualClientId);
    if (!ic) return res.status(400).json({ error: "invalid individualClientId" });
    payload.individualClient = ic._id;
  }

  const created = await Payment.create(payload);

  // Side effects
  if (created.linkedType === "business" && created.businessClient) {
    await BusinessClient.findByIdAndUpdate(created.businessClient, { $inc: { runningBalance: -created.amount } });
  }
  if (created.linkedType === "individual" && created.individualClient) {
    const updated = await IndividualClient.findByIdAndUpdate(
      created.individualClient,
      { $inc: { amountOwed: -created.amount } },
      { new: true }
    );
    if (updated && updated.amountOwed <= 0) {
      await IndividualClient.findByIdAndUpdate(updated._id, { $set: { status: "paid", amountOwed: 0 } });
    }
  }

  const full = await Payment.findById(created._id).populate("businessClient").populate("individualClient");
  res.status(201).json(full);
});

router.delete("/:id", async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ error: "not found" });

  await Payment.deleteOne({ _id: payment._id });

  // Reverse side effects
  if (payment.linkedType === "business" && payment.businessClient) {
    await BusinessClient.findByIdAndUpdate(payment.businessClient, { $inc: { runningBalance: payment.amount } });
  }
  if (payment.linkedType === "individual" && payment.individualClient) {
    await IndividualClient.findByIdAndUpdate(payment.individualClient, { $inc: { amountOwed: payment.amount } });
  }

  res.json({ ok: true });
});

module.exports = router;

