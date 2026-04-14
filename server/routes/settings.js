const express  = require("express");
const Settings = require("../models/Settings");
const { updateSettingsRules } = require("../middleware/validate");

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

router.put("/", ...updateSettingsRules, async (req, res) => {
  const { businessName, businessAddress, bankName, accountNumber, sortCode, whatsappBusinessNumber } = req.body || {};
  const s = await getSingleton();

  if (businessName    !== undefined) s.businessName    = String(businessName).trim();
  if (businessAddress !== undefined) s.businessAddress = String(businessAddress).trim();
  if (bankName        !== undefined) s.bankName        = String(bankName).trim();
  if (accountNumber   !== undefined) s.accountNumber   = String(accountNumber).trim();
  if (sortCode        !== undefined) s.sortCode        = String(sortCode).trim();
  if (whatsappBusinessNumber !== undefined) s.whatsappBusinessNumber = String(whatsappBusinessNumber).trim();

  await s.save();
  res.json(s);
});

module.exports = router;
