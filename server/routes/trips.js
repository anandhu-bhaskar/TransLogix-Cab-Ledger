const express = require("express");

const Trip = require("../models/Trip");
const Worker = require("../models/Worker");
const Route = require("../models/Route");
const BusinessClient = require("../models/BusinessClient");
const IndividualClient = require("../models/IndividualClient");

const router = express.Router();

function toDate(val) {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

router.get("/", async (req, res) => {
  const { from, to, paymentMethod } = req.query;
  const q = {};
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = toDate(from);
    if (to) q.date.$lte = toDate(to);
  }
  if (paymentMethod) q.paymentMethod = paymentMethod;

  const trips = await Trip.find(q)
    .sort({ date: -1 })
    .populate("route")
    .populate("workers")
    .populate("businessClient")
    .populate("payers.client");

  res.json(trips);
});

router.post("/", async (req, res) => {
  const {
    date,
    routeId,
    customRouteName,
    variant,
    workerIds,
    customWorkerNames,  // free-text names
    unspecifiedWorkers, // boolean
    numberOfPeople,     // manual count (used when unspecified or as override)
    totalAmount,
    notes,
    paymentMethod,
    payerClientIds,   // array of IndividualClient IDs for direct
    partnerClientId   // BusinessClient ID for partner
  } = req.body || {};

  const d = toDate(date);
  if (!d) return res.status(400).json({ error: "Valid date is required." });

  const total = Number(totalAmount);
  if (!Number.isFinite(total) || total < 0)
    return res.status(400).json({ error: "totalAmount must be a positive number." });

  if (!["direct", "partner"].includes(paymentMethod))
    return res.status(400).json({ error: "paymentMethod must be direct or partner." });

  // Resolve route
  let resolvedRoute = null;
  let resolvedCustomName = "";
  if (routeId && routeId !== "other") {
    resolvedRoute = await Route.findById(routeId);
    if (!resolvedRoute) return res.status(400).json({ error: "Invalid routeId." });
  } else {
    resolvedCustomName = customRouteName ? String(customRouteName).trim() : "";
    if (!resolvedCustomName) return res.status(400).json({ error: "Custom route name is required when route is Other." });
  }

  // Resolve workers
  const workerIdsArr = Array.isArray(workerIds) ? workerIds : [];
  const workerDocs = await Worker.find({ _id: { $in: workerIdsArr } });
  const uniqueWorkerIds = [...new Set(workerDocs.map(w => String(w._id)))];

  const tripPayload = {
    date: d,
    route: resolvedRoute ? resolvedRoute._id : undefined,
    customRouteName: resolvedCustomName,
    variant: variant ? String(variant).trim() : "",
    workers: uniqueWorkerIds,
    customWorkerNames: Array.isArray(customWorkerNames)
      ? customWorkerNames.map(n => String(n).trim()).filter(Boolean)
      : [],
    unspecifiedWorkers: !!unspecifiedWorkers,
    numberOfPeople: Number(numberOfPeople) || undefined,
    totalAmount: total,
    notes: notes ? String(notes).trim() : "",
    paymentMethod
  };

  if (paymentMethod === "direct") {
    const payerIds = Array.isArray(payerClientIds) ? payerClientIds : [];
    if (!payerIds.length) return res.status(400).json({ error: "Select at least one paying client." });

    const payerDocs = await IndividualClient.find({ _id: { $in: payerIds } });
    if (!payerDocs.length) return res.status(400).json({ error: "No valid payer clients found." });

    const amountEach = Number((total / payerDocs.length).toFixed(2));
    tripPayload.payers = payerDocs.map(c => ({ client: c._id, amount: amountEach }));
    tripPayload.amountPerPerson = amountEach;

  } else if (paymentMethod === "partner") {
    if (!partnerClientId) return res.status(400).json({ error: "Partner client is required." });
    const partner = await BusinessClient.findById(partnerClientId);
    if (!partner) return res.status(400).json({ error: "Invalid partner client." });
    tripPayload.businessClient = partner._id;
    const peopleCount = Number(numberOfPeople) || uniqueWorkerIds.length || 1;
    tripPayload.amountPerPerson = Number((total / peopleCount).toFixed(2));
  }

  const created = await Trip.create(tripPayload);

  // Side effects
  if (created.paymentMethod === "direct" && created.payers.length) {
    for (const p of created.payers) {
      await IndividualClient.findByIdAndUpdate(p.client, {
        $inc: { amountOwed: p.amount },
        $set: { status: "unpaid" }
      });
    }
  }
  if (created.paymentMethod === "partner" && created.businessClient) {
    await BusinessClient.findByIdAndUpdate(created.businessClient, {
      $inc: { runningBalance: created.totalAmount }
    });
  }

  const trip = await Trip.findById(created._id)
    .populate("route")
    .populate("workers")
    .populate("businessClient")
    .populate("payers.client");

  res.status(201).json(trip);
});

router.delete("/:id", async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return res.status(404).json({ error: "Not found." });

  await Trip.deleteOne({ _id: trip._id });

  // Reverse side effects
  if (trip.paymentMethod === "direct" && trip.payers.length) {
    for (const p of trip.payers) {
      await IndividualClient.findByIdAndUpdate(p.client, { $inc: { amountOwed: -p.amount } });
    }
  }
  if (trip.paymentMethod === "partner" && trip.businessClient) {
    await BusinessClient.findByIdAndUpdate(trip.businessClient, {
      $inc: { runningBalance: -trip.totalAmount }
    });
  }
  // legacy
  if (trip.payerType === "individual" && trip.individualClient) {
    await IndividualClient.findByIdAndUpdate(trip.individualClient, {
      $inc: { amountOwed: -trip.totalAmount }
    });
  }
  if (trip.payerType === "business" && trip.businessClient) {
    await BusinessClient.findByIdAndUpdate(trip.businessClient, {
      $inc: { runningBalance: -trip.totalAmount }
    });
  }

  res.json({ ok: true });
});

module.exports = router;
