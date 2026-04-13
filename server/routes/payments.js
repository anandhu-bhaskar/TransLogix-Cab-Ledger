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
  const {
    payerName, amount, date, method,
    linkedType,
    businessClientId, individualClientId,
    thirdPartyPayer, paidByName
  } = req.body || {};

  if (!payerName?.trim()) return res.status(400).json({ error: "payerName is required" });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: "Valid amount required" });
  const d = new Date(date);
  if (isNaN(d.getTime())) return res.status(400).json({ error: "Valid date required" });
  if (!["Bank Transfer", "Cash", "Revolut"].includes(method))
    return res.status(400).json({ error: "Method must be Bank Transfer, Cash or Revolut" });

  // Normalise: accept both old and new linkedType values
  const isPartner = linkedType === "partner" || linkedType === "business";
  const isDirect = linkedType === "direct" || linkedType === "individual";
  if (!isPartner && !isDirect)
    return res.status(400).json({ error: "linkedType must be direct or partner" });

  const payload = {
    payerName: payerName.trim(),
    amount: amt,
    date: d,
    method,
    linkedType: isPartner ? "partner" : "direct",
    thirdPartyPayer: thirdPartyPayer === "true" || thirdPartyPayer === true,
    paidByName: paidByName ? String(paidByName).trim() : ""
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

  if (isPartner) {
    // Partner payments: prefer individualClientId (new UI), fall back to businessClientId (old UI)
    const partnerLookupId = individualClientId || businessClientId;
    if (partnerLookupId) {
      // Try IndividualClient first (new flow)
      const ic = await IndividualClient.findById(partnerLookupId).catch(() => null);
      if (ic) {
        payload.individualClient = ic._id;
      } else {
        // Fall back to BusinessClient (legacy flow)
        const bc = await BusinessClient.findById(partnerLookupId).catch(() => null);
        if (!bc) return res.status(400).json({ error: "Invalid partner client" });
        payload.businessClient = bc._id;
      }
    }
  } else {
    if (!individualClientId) return res.status(400).json({ error: "individualClientId required for direct payment" });
    const ic = await IndividualClient.findById(individualClientId);
    if (!ic) return res.status(400).json({ error: "Invalid individualClientId" });
    payload.individualClient = ic._id;
  }

  const created = await Payment.create(payload);

  // Side effects
  if (isPartner && created.businessClient) {
    // Legacy: BusinessClient balance
    await BusinessClient.findByIdAndUpdate(created.businessClient, { $inc: { runningBalance: -created.amount } });
  }
  if (created.individualClient) {
    // Both direct and partner (new flow) update IndividualClient.amountOwed
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

  const isPartner = payment.linkedType === "partner" || payment.linkedType === "business";
  const isDirect = payment.linkedType === "direct" || payment.linkedType === "individual";

  if (isPartner && payment.businessClient)
    await BusinessClient.findByIdAndUpdate(payment.businessClient, { $inc: { runningBalance: payment.amount } });
  if (payment.individualClient)
    await IndividualClient.findByIdAndUpdate(payment.individualClient, { $inc: { amountOwed: payment.amount } });

  res.json({ ok: true });
});

module.exports = router;
