const express = require("express");
const Settings = require("../models/Settings");

const router = express.Router();

async function getSingleton() {
  let s = await Settings.findOne({});
  if (!s) s = await Settings.create({});
  return s;
}

router.get("/", async (req, res) => {
  const s = await getSingleton();
  res.json(s);
});

router.put("/", async (req, res) => {
  const { bankName, accountNumber, sortCode, whatsappBusinessNumber, textbeeApiKey, textbeeDeviceId } = req.body || {};
  const s = await getSingleton();

  if (bankName !== undefined) s.bankName = String(bankName).trim();
  if (accountNumber !== undefined) s.accountNumber = String(accountNumber).trim();
  if (sortCode !== undefined) s.sortCode = String(sortCode).trim();
  if (whatsappBusinessNumber !== undefined) s.whatsappBusinessNumber = String(whatsappBusinessNumber).trim();
  if (textbeeApiKey !== undefined) s.textbeeApiKey = String(textbeeApiKey).trim();
  if (textbeeDeviceId !== undefined) s.textbeeDeviceId = String(textbeeDeviceId).trim();

  await s.save();
  res.json(s);
});

module.exports = router;

