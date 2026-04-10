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

async function loadClients() {
  const clients = await api("/api/individual-clients");
  const sel = document.getElementById("clientId");
  sel.innerHTML = `<option value="">Select client…</option>`;
  clients.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c._id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

document.getElementById("invoiceForm").addEventListener("submit", async e => {
  e.preventDefault();
  const clientId = document.getElementById("clientId").value;
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;
  const prevBalance = document.getElementById("prevBalance").value;

  if (!clientId) return toast("Please select a client.");
  if (!from || !to) return toast("Please select a date range.");

  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  btn.textContent = "Generating…";
  try {
    const res = await fetch("/api/invoice/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ individualClientId: clientId, from, to, previousBalance: prevBalance || 0 })
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Generation failed.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_${from}_${to}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Invoice downloaded.");
  } catch(err) { toast(`Error: ${err.message}`); }
  finally { btn.disabled = false; btn.textContent = "Download invoice"; }
});

document.addEventListener("DOMContentLoaded", () => {
  // default to current month range
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  document.getElementById("fromDate").value = new Date(y, m, 1).toISOString().slice(0, 10);
  document.getElementById("toDate").value = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  loadClients().catch(e => toast(e.message));
});
