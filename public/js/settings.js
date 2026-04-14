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
  document.getElementById("businessName").value    = s.businessName    || "";
  document.getElementById("businessAddress").value = s.businessAddress || "";
  document.getElementById("bankName").value        = s.bankName        || "";
  document.getElementById("accountNumber").value   = s.accountNumber   || "";
  document.getElementById("sortCode").value        = s.sortCode        || "";
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
        businessName:    document.getElementById("businessName").value.trim(),
        businessAddress: document.getElementById("businessAddress").value.trim(),
        bankName:        document.getElementById("bankName").value.trim(),
        accountNumber:   document.getElementById("accountNumber").value.trim(),
        sortCode:        document.getElementById("sortCode").value.trim(),
        whatsappBusinessNumber: document.getElementById("whatsappBusinessNumber").value.trim()
      })
    });
    toast("Settings saved.");
  } catch(err) { toast(`Error: ${err.message}`); }
  finally { btn.disabled = false; }
});


document.addEventListener("DOMContentLoaded", () => loadSettings().catch(e => toast(e.message)));
