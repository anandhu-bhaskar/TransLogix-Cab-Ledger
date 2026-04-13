/**
 * TextBee SMS helper.
 * Docs: https://docs.textbee.dev
 *
 * POST https://api.textbee.dev/api/v1/gateway/devices/{deviceId}/sendSMS
 * Header: x-api-key: <apiKey>
 * Body:   { "recipients": ["+44..."], "message": "..." }
 */

async function sendSms({ apiKey, deviceId, recipients, message }) {
  if (!apiKey || !deviceId) throw new Error("TextBee API key and Device ID are required.");
  if (!recipients || !recipients.length) throw new Error("No recipients provided.");

  const url = `https://api.textbee.dev/api/v1/gateway/devices/${encodeURIComponent(deviceId)}/sendSMS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({ recipients, message })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `TextBee error ${res.status}`);
  }

  return res.json();
}

module.exports = { sendSms };
