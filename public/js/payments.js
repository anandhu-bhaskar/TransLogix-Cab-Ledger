function money(n) { return `£${(Number(n) || 0).toFixed(2)}`; }
function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? "" : d.toISOString().slice(0, 10); }
function escapeHtml(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
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
    opt.textContent = `${c.name}${c.amountOwed > 0 ? ` — owes ${money(c.amountOwed)}` : ""}`;
    sel.appendChild(opt);
  });
}

async function loadPayments() {
  const payments = await api("/api/payments");
  const tbody = document.getElementById("paymentsTbody");
  tbody.innerHTML = "";
  if (!payments.length) { document.getElementById("paymentsEmpty").style.display = "block"; return; }
  document.getElementById("paymentsEmpty").style.display = "none";

  payments.slice(0, 60).forEach(p => {
    const name = p.individualClient?.name || p.payerName || "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(name)}</strong></td>
      <td>${fmtDate(p.date)}</td>
      <td>${escapeHtml(p.method)}</td>
      <td>${money(p.amount)}</td>
      <td style="text-align:right">
        <button class="btn small" data-del="${p._id}" type="button">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this payment? The client balance will be restored.")) return;
      try {
        await api(`/api/payments/${btn.dataset.del}`, { method: "DELETE" });
        toast("Payment deleted.");
        await Promise.all([loadPayments(), loadClients()]);
      } catch(e) { toast(`Error: ${e.message}`); }
    });
  });
}

document.getElementById("paymentForm").addEventListener("submit", async e => {
  e.preventDefault();
  const clientId = document.getElementById("clientId").value;
  const amount = Number(document.getElementById("amount").value);
  const date = document.getElementById("payDate").value;
  const method = document.getElementById("method").value;

  if (!clientId) return toast("Please select a client.");
  if (!amount || amount <= 0) return toast("Please enter a valid amount.");

  const client = document.querySelector(`#clientId option[value="${clientId}"]`)?.textContent?.split(" —")[0] || "";

  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  try {
    await api("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payerName: client,
        amount,
        date,
        method,
        linkedType: "individual",
        individualClient: clientId
      })
    });
    toast("Payment saved.");
    e.target.reset();
    document.getElementById("payDate").valueAsDate = new Date();
    await Promise.all([loadPayments(), loadClients()]);
  } catch(err) { toast(`Error: ${err.message}`); }
  finally { btn.disabled = false; }
});

document.getElementById("resetBtn").addEventListener("click", () => {
  document.getElementById("paymentForm").reset();
  document.getElementById("payDate").valueAsDate = new Date();
});
document.getElementById("refreshBtn").addEventListener("click", loadPayments);

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("payDate").valueAsDate = new Date();
  try {
    await Promise.all([loadClients(), loadPayments()]);
  } catch(e) { toast(`Failed to load: ${e.message}`); }
});
