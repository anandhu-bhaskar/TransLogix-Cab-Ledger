function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(window.__t); window.__t = setTimeout(() => el.classList.remove("show"), 3200);
}
async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || res.statusText); }
  return res.json();
}

async function loadSettings() {
  const s = await api("/api/settings");
  document.getElementById("bankName").value = s.bankName || "";
  document.getElementById("accountNumber").value = s.accountNumber || "";
  document.getElementById("sortCode").value = s.sortCode || "";
  document.getElementById("whatsappBusinessNumber").value = s.whatsappBusinessNumber || "";
}

document.getElementById("settingsForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  try {
    await api("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankName: document.getElementById("bankName").value.trim(),
        accountNumber: document.getElementById("accountNumber").value.trim(),
        sortCode: document.getElementById("sortCode").value.trim(),
        whatsappBusinessNumber: document.getElementById("whatsappBusinessNumber").value.trim()
      })
    });
    toast("Settings saved.");
  } catch(err) { toast(`Error: ${err.message}`); }
  finally { btn.disabled = false; }
});

// ── SMS settings (per-user) ────────────────────────────────

let smsCfg = { smsEnabled: false, hasApiKey: false, deviceId: "", configured: false };

function renderSmsStatus() {
  const badge = document.getElementById("smsStatusBadge");
  const enableWrap = document.getElementById("smsEnableWrap");
  const testBtn = document.getElementById("testSmsBtn");
  const clearBtn = document.getElementById("clearSmsBtn");
  const apiKeyStatus = document.getElementById("apiKeyStatus");
  const enabledChk = document.getElementById("smsEnabled");

  if (smsCfg.configured) {
    badge.style.display = "inline-flex";
    badge.innerHTML = `<span class="pill good" style="font-size:12px">Connected</span>`;
    apiKeyStatus.textContent = "API key saved (hidden for security).";
    document.getElementById("textbeeDeviceId").value = smsCfg.deviceId;
    enableWrap.style.display = "block";
    enabledChk.checked = smsCfg.smsEnabled;
    testBtn.style.display = "inline-flex";
    clearBtn.style.display = "inline-flex";
  } else {
    badge.style.display = "inline-flex";
    badge.innerHTML = `<span class="pill" style="font-size:12px;color:#666">Not configured</span>`;
    apiKeyStatus.textContent = "";
    enableWrap.style.display = "none";
    testBtn.style.display = "none";
    clearBtn.style.display = "none";
  }
}

async function loadSmsSettings() {
  smsCfg = await api("/api/user/sms-settings");
  renderSmsStatus();
}

document.getElementById("textbeeForm").addEventListener("submit", async e => {
  e.preventDefault();
  const apiKey = document.getElementById("textbeeApiKey").value.trim();
  const deviceId = document.getElementById("textbeeDeviceId").value.trim();
  const smsEnabled = document.getElementById("smsEnabled").checked;

  if (!apiKey && !smsCfg.hasApiKey) return toast("Please enter your TextBee API key.");
  if (!deviceId) return toast("Please enter your TextBee Device ID.");

  const body = { deviceId, smsEnabled };
  if (apiKey) body.apiKey = apiKey; // only send if user typed something new

  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  const note = document.getElementById("smsFormNote");
  note.style.display = "none";
  try {
    smsCfg = await api("/api/user/sms-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    document.getElementById("textbeeApiKey").value = ""; // clear input — key is now stored
    renderSmsStatus();
    note.style.display = "block";
    note.textContent = "Credentials saved securely.";
    toast("SMS settings saved.");
  } catch(err) {
    toast(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
});

// Toggle smsEnabled live when checkbox changes
document.getElementById("smsEnabled").addEventListener("change", async () => {
  try {
    smsCfg = await api("/api/user/sms-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smsEnabled: document.getElementById("smsEnabled").checked })
    });
    toast(smsCfg.smsEnabled ? "SMS notifications enabled." : "SMS notifications disabled.");
  } catch(e) { toast(`Error: ${e.message}`); }
});

document.getElementById("testSmsBtn").addEventListener("click", async () => {
  const phone = prompt("Phone number to test (e.g. +447911123456):");
  if (!phone) return;
  const note = document.getElementById("smsFormNote");
  note.style.display = "block";
  note.textContent = "Sending test SMS…";
  try {
    await api("/api/user/sms-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    note.textContent = "Test SMS sent — check your phone!";
    toast("Test SMS sent.");
  } catch(err) {
    note.textContent = `Failed: ${err.message}`;
    toast(`SMS error: ${err.message}`);
  }
});

document.getElementById("clearSmsBtn").addEventListener("click", async () => {
  if (!confirm("Remove your TextBee credentials? SMS will be disabled.")) return;
  try {
    smsCfg = await api("/api/user/sms-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "", deviceId: "", smsEnabled: false })
    });
    document.getElementById("textbeeApiKey").value = "";
    document.getElementById("textbeeDeviceId").value = "";
    renderSmsStatus();
    toast("SMS credentials removed.");
  } catch(e) { toast(`Error: ${e.message}`); }
});

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().catch(e => toast(e.message));
  loadSmsSettings().catch(e => toast(e.message));
});
