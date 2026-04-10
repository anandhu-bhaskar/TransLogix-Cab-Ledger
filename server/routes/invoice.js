const express = require("express");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType
} = require("docx");

const Trip = require("../models/Trip");
const Payment = require("../models/Payment");
const BusinessClient = require("../models/BusinessClient");

const router = express.Router();

function toDate(val) {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function money(n) {
  const v = Number(n) || 0;
  return `£${v.toFixed(2)}`;
}

function fmtDate(d) {
  const dd = new Date(d);
  return dd.toISOString().slice(0, 10);
}

function heading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true })],
    spacing: { after: 240 }
  });
}

function makeTable(headers, rows) {
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })]
        })
    )
  });

  const bodyRows = rows.map(
    (cells) =>
      new TableRow({
        children: cells.map((c) => new TableCell({ children: [new Paragraph(String(c ?? ""))] }))
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows]
  });
}

router.post("/generate", async (req, res) => {
  const { businessClientId, from, to, previousBalance } = req.body || {};
  if (!businessClientId) return res.status(400).json({ error: "businessClientId is required" });

  const bc = await BusinessClient.findById(businessClientId);
  if (!bc) return res.status(400).json({ error: "invalid businessClientId" });

  const fromDate = toDate(from);
  const toDateVal = toDate(to);
  if (!fromDate || !toDateVal) return res.status(400).json({ error: "from and to must be valid dates" });

  const trips = await Trip.find({
    payerType: "business",
    businessClient: bc._id,
    date: { $gte: fromDate, $lte: toDateVal }
  })
    .sort({ date: 1 })
    .populate("route")
    .populate("workers");

  const payments = await Payment.find({
    linkedType: "business",
    businessClient: bc._id,
    date: { $gte: fromDate, $lte: toDateVal }
  }).sort({ date: 1 });

  const newChargesTotal = trips.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);
  const paymentsTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const prev = Number(previousBalance);
  const prevBal = Number.isFinite(prev) ? prev : Number(bc.runningBalance) || 0;
  const balanceAfterPayments = prevBal - paymentsTotal;
  const currentBalance = balanceAfterPayments + newChargesTotal;

  const tripRows = trips.map((t) => [
    fmtDate(t.date),
    `${t.route?.name || ""}${t.variant ? ` - ${t.variant}` : ""}`,
    (t.workers || []).map((w) => w.name).join(", "),
    money(t.totalAmount)
  ]);

  const paymentRows = payments.map((p) => [p.payerName, fmtDate(p.date), p.method, money(p.amount)]);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Billing Summary - ${bc.name}`, bold: true, size: 32 })],
            spacing: { after: 300 }
          }),

          heading(`Section 1: NEW CHARGES (${fmtDate(fromDate)} to ${fmtDate(toDateVal)})`),
          makeTable(["Date", "Job/Route", "Participants", "Amount"], tripRows),
          new Paragraph({ text: "", spacing: { after: 240 } }),

          heading("Section 2: PAYMENTS RECEIVED"),
          makeTable(["Name", "Date", "Method", "Amount"], paymentRows),
          new Paragraph({ text: "", spacing: { after: 240 } }),

          heading("Section 3: BALANCE SUMMARY"),
          makeTable(
            ["Item", "Amount"],
            [
              ["Previous balance", money(prevBal)],
              ["Payments received", money(paymentsTotal)],
              ["Balance after payments", money(balanceAfterPayments)],
              ["New charges", money(newChargesTotal)],
              ["Current balance", money(currentBalance)]
            ]
          )
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `invoice_${bc.name.replace(/\s+/g, "_")}_${fmtDate(fromDate)}_${fmtDate(toDateVal)}.docx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

module.exports = router;

