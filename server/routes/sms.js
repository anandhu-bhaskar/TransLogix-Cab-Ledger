const express = require("express");
const Settings = require("../models/Settings");
const { sendSms } = require("../utils/textbee");

const router = express.Router();

// POST /api/sms/test — send a test SMS to verify credentials
router.post("/test", async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: "phone is required" });

  const s = await Settings.findOne({});
  if (!s?.textbeeApiKey || !s?.textbeeDeviceId)
    return res.status(400).json({ error: "TextBee API key and Device ID not configured in Settings." });

  try {
    await sendSms({
      apiKey: s.textbeeApiKey,
      deviceId: s.textbeeDeviceId,
      recipients: [phone],
      message: "Test message from Transport Billing. TextBee is working correctly."
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
