const express = require("express");
const User = require("../models/User");
const { sendSms } = require("../utils/textbee");
const { encrypt, decrypt } = require("../utils/crypto");

const router = express.Router();

// GET /api/user/sms-settings
// Returns config status — API key is NEVER sent back to the frontend.
router.get("/sms-settings", async (req, res) => {
  const user = await User.findById(req.user._id);
  const hasApiKey = !!(user.textbee?.apiKeyEnc && decrypt(user.textbee.apiKeyEnc));
  res.json({
    smsEnabled: user.smsEnabled || false,
    hasApiKey,
    deviceId: user.textbee?.deviceId || "",
    // Connection status derived from whether both values are present
    configured: hasApiKey && !!(user.textbee?.deviceId)
  });
});

// PUT /api/user/sms-settings
// Accepts { apiKey?, deviceId?, smsEnabled? }
// apiKey is immediately encrypted before storage.
router.put("/sms-settings", async (req, res) => {
  const { apiKey, deviceId, smsEnabled } = req.body || {};
  const user = await User.findById(req.user._id);

  if (apiKey !== undefined) {
    // Empty string = clear the key
    user.textbee = user.textbee || {};
    user.textbee.apiKeyEnc = apiKey.trim() ? encrypt(apiKey.trim()) : "";
  }
  if (deviceId !== undefined) {
    user.textbee = user.textbee || {};
    user.textbee.deviceId = String(deviceId).trim();
  }
  if (smsEnabled !== undefined) {
    user.smsEnabled = Boolean(smsEnabled);
  }

  // Auto-disable if credentials are now incomplete
  const hasKey = !!(user.textbee?.apiKeyEnc && decrypt(user.textbee.apiKeyEnc));
  const hasDevice = !!(user.textbee?.deviceId);
  if (!hasKey || !hasDevice) user.smsEnabled = false;

  await User.findByIdAndUpdate(user._id, {
    $set: {
      smsEnabled: user.smsEnabled,
      "textbee.apiKeyEnc": user.textbee?.apiKeyEnc || "",
      "textbee.deviceId": user.textbee?.deviceId || ""
    }
  });

  res.json({
    smsEnabled: user.smsEnabled,
    hasApiKey: hasKey,
    deviceId: user.textbee?.deviceId || "",
    configured: hasKey && hasDevice
  });
});

// POST /api/user/sms-test
// Sends a test SMS to a given number using the current user's credentials.
router.post("/sms-test", async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: "phone is required" });

  const user = await User.findById(req.user._id);
  const apiKey = decrypt(user.textbee?.apiKeyEnc || "");
  const deviceId = user.textbee?.deviceId;

  if (!apiKey || !deviceId)
    return res.status(400).json({ error: "TextBee credentials not configured. Add them in Settings first." });

  try {
    await sendSms({
      apiKey,
      deviceId,
      recipients: [phone],
      message: "Test message from Transport Billing — TextBee is working correctly! 🎉"
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
