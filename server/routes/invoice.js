const express = require("express");

const Trip            = require("../models/Trip");
const Payment         = require("../models/Payment");
const IndividualClient = require("../models/IndividualClient");

const router = express.Router();

function toDate(val) {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// POST /api/invoice/data
// Returns structured billing data for an individual client + date range
router.post("/data", async (req, res) => {
  const { individualClientId, from, to, previousBalance } = req.body || {};

  if (!individualClientId) return res.status(400).json({ error: "individualClientId is required" });

  const client = await IndividualClient.findById(individualClientId);
  if (!client) return res.status(400).json({ error: "Client not found" });

  const fromDate = toDate(from);
  const toDateVal = toDate(to);
  if (!fromDate || !toDateVal) return res.status(400).json({ error: "from and to must be valid dates" });

  // End of day for toDate
  const toEnd = new Date(toDateVal);
  toEnd.setHours(23, 59, 59, 999);

  // Trips where this client is a direct payer
  const trips = await Trip.find({
    paymentMethod: "direct",
    "payers.client": client._id,
    date: { $gte: fromDate, $lte: toEnd }
  })
    .sort({ date: 1 })
    .populate("workers");

  // Payments received from this client
  const payments = await Payment.find({
    individualClient: client._id,
    date: { $gte: fromDate, $lte: toEnd }
  }).sort({ date: 1 });

  const prevBal = Number(previousBalance) || 0;

  // Normalise trip data: calculate per-person share
  const tripData = trips.map(t => {
    const payerCount = (t.payers || []).length || 1;
    const share = Number(t.totalAmount) / payerCount;
    const routeLabel = t.origin && t.destination
      ? `${t.origin} → ${t.destination}`
      : t.customRouteName || "";
    const people = t.numberOfPeople
      || ((t.workers || []).length + (t.customWorkerNames || []).length) || null;
    return {
      date:    t.date,
      origin:  t.origin,
      destination: t.destination,
      route:   routeLabel,
      variant: t.variant,
      people,
      amount:  share
    };
  });

  const paymentData = payments.map(p => ({
    date:       p.date,
    method:     p.method,
    payerName:  p.payerName,
    paidByName: p.thirdPartyPayer ? p.paidByName : null,
    amount:     p.amount
  }));

  res.json({
    client: {
      name:             client.name,
      organisation:     client.organisation,
      carehomeLocation: client.carehomeLocation,
      postcode:         client.postcode
    },
    trips:           tripData,
    payments:        paymentData,
    previousBalance: prevBal
  });
});

module.exports = router;
