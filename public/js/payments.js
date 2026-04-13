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

// ── Load client dropdowns ──────────────────────────────────

async function loadIndividualClients() {
  const clients = await api("/api/individual-clients");
  const sel = document.getElementById("individualClientId");
  sel.innerHTML = `<option value="">Select client…</option>`;
  clients.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c._id;
    opt.dataset.name = c.name;
    opt.textContent = `${c.name}${c.amountOwed > 0 ? ` — owes ${money(c.amountOwed)}` : ""}`;
    sel.appendChild(opt);
  });
}

async function loadPartnerClients() {
  // Partner clients = individual clients with clientType "partner"
  const clients = await api("/api/individual-clients");
  const sel = document.getElementById("partnerClientId");
  sel.innerHTML = `<option value="">Select partner…</option>`;
  clients
    .filter(c => c.clientType === "partner")
    .forEach(c => {
      const opt = document.createElement("option");
      opt.value = c._id;
      opt.dataset.name = c.name;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
}

// ── Payments ledger ────────────────────────────────────────

async function loadPayments() {
  const payments = await api("/api/payments");
  const tbody = document.getElementById("paymentsTbody");
  tbody.innerHTML = "";
  if (!payments.length) {
    document.getElementById("paymentsEmpty").style.display = "block";
    return;
  }
  document.getElementById("paymentsEmpty").style.display = "none";

  payments.slice(0, 80).forEach(p => {
    const clientName = p.individualClient?.name || p.businessClient?.name || p.payerName || "—";
    const isPartner = p.linkedType === "partner" || p.linkedType === "business";
    const typePill = isPartner
      ? `<span class="pill bad" style="font-size:11px">Partner</span>`
      : `<span class="pill" style="font-size:11px">Direct</span>`;

    let proofCell = "—";
    if (p.proof?.url) {
      const isImage = p.proof.resourceType === "image" || /\.(png|jpe?g|gif|webp)$/i.test(p.proof.url);
      proofCell = isImage
        ? `<a href="${escapeHtml(p.proof.url)}" target="_blank" rel="noreferrer" class="btn small">View</a>`
        : `<a href="${escapeHtml(p.proof.url)}" target="_blank" rel="noreferrer" class="btn small">PDF</a>`;
    }

    let nameCell = escapeHtml(clientName);
    if (p.thirdPartyPayer && p.paidByName) {
      nameCell += ` <span class="pill" style="font-size:11px" title="Paid by ${escapeHtml(p.paidByName)}">via ${escapeHtml(p.paidByName)}</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${nameCell}</strong></td>
      <td>${typePill}</td>
      <td>${fmtDate(p.date)}</td>
      <td>${escapeHtml(p.method)}</td>
      <td>${money(p.amount)}</td>
      <td>${proofCell}</td>
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
        btn.disabled = true;
        await api(`/api/payments/${btn.dataset.del}`, { method: "DELETE" });
        toast("Payment deleted.");
        await Promise.all([loadPayments(), loadIndividualClients(), loadPartnerClients()]);
      } catch(e) {
        toast(`Error: ${e.message}`);
        btn.disabled = false;
      }
    });
  });
}

// ── Client type toggle ─────────────────────────────────────

function syncClientTypeUI() {
  const type = document.getElementById("linkedType").value;
  document.getElementById("directClientWrap").style.display = type === "direct" ? "block" : "none";
  document.getElementById("partnerClientWrap").style.display = type === "partner" ? "block" : "none";
}

document.querySelectorAll(".pay-type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pay-type-btn").forEach(b => b.classList.remove("active-type"));
    btn.classList.add("active-type");
    document.getElementById("linkedType").value = btn.dataset.type;
    syncClientTypeUI();
  });
});

// ── Payment method toggle ──────────────────────────────────

document.querySelectorAll(".pay-method-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pay-method-btn").forEach(b => b.classList.remove("active-method"));
    btn.classList.add("active-method");
    document.getElementById("method").value = btn.dataset.method;
  });
});

// ── Proof file label ───────────────────────────────────────

document.getElementById("proofFile").addEventListener("change", () => {
  const file = document.getElementById("proofFile").files[0];
  document.getElementById("proofLabel").textContent = file ? file.name : "Choose file…";
  document.getElementById("proofNote").textContent = file
    ? `${(file.size / 1024).toFixed(0)} KB — ${file.type || "unknown type"}`
    : "";
});

// ── Third-party payer ──────────────────────────────────────

document.getElementById("thirdPartyCheck").addEventListener("change", () => {
  const checked = document.getElementById("thirdPartyCheck").checked;
  document.getElementById("paidByWrap").style.display = checked ? "block" : "none";
  if (!checked) document.getElementById("paidByName").value = "";
});

// ── Form submit ────────────────────────────────────────────

document.getElementById("paymentForm").addEventListener("submit", async e => {
  e.preventDefault();

  const linkedType = document.getElementById("linkedType").value;
  const amount = Number(document.getElementById("amount").value);
  const date = document.getElementById("payDate").value;
  const method = document.getElementById("method").value;
  const thirdParty = document.getElementById("thirdPartyCheck").checked;
  const paidByName = document.getElementById("paidByName").value.trim();
  const proofFile = document.getElementById("proofFile").files[0];

  if (!amount || amount <= 0) return toast("Please enter a valid amount.");
  if (!date) return toast("Please select a date.");

  let payerName = "";
  let clientId = "";

  if (linkedType === "direct") {
    const sel = document.getElementById("individualClientId");
    clientId = sel.value;
    if (!clientId) return toast("Please select a client.");
    payerName = sel.options[sel.selectedIndex]?.dataset.name || sel.options[sel.selectedIndex]?.text?.split(" —")[0] || "";
  } else {
    const sel = document.getElementById("partnerClientId");
    clientId = sel.value;
    if (!clientId) return toast("Please select a partner client.");
    payerName = sel.options[sel.selectedIndex]?.dataset.name || sel.options[sel.selectedIndex]?.text || "";
  }

  const fd = new FormData();
  fd.append("payerName", payerName);
  fd.append("amount", amount);
  fd.append("date", date);
  fd.append("method", method);
  fd.append("linkedType", linkedType);
  fd.append("individualClientId", clientId);
  fd.append("thirdPartyPayer", thirdParty ? "true" : "false");
  if (thirdParty && paidByName) fd.append("paidByName", paidByName);
  if (proofFile) fd.append("proof", proofFile);

  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  try {
    await fetch("/api/payments", { method: "POST", body: fd }).then(async res => {
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || res.statusText); }
      return res.json();
    });
    toast("Payment saved.");
    resetForm();
    await Promise.all([loadPayments(), loadIndividualClients(), loadPartnerClients()]);
  } catch(err) {
    toast(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
});

// ── Reset ──────────────────────────────────────────────────

function resetForm() {
  document.getElementById("paymentForm").reset();
  document.getElementById("payDate").valueAsDate = new Date();
  document.getElementById("linkedType").value = "direct";
  document.querySelectorAll(".pay-type-btn").forEach(b => {
    b.classList.toggle("active-type", b.dataset.type === "direct");
  });
  document.querySelectorAll(".pay-method-btn").forEach(b => {
    b.classList.toggle("active-method", b.dataset.method === "Bank Transfer");
  });
  document.getElementById("method").value = "Bank Transfer";
  document.getElementById("proofLabel").textContent = "Choose file…";
  document.getElementById("proofNote").textContent = "";
  document.getElementById("paidByWrap").style.display = "none";
  document.getElementById("partnerClientId").value = "";
  document.getElementById("individualClientId").value = "";
  syncClientTypeUI();
}

document.getElementById("resetBtn").addEventListener("click", resetForm);
document.getElementById("refreshBtn").addEventListener("click", loadPayments);

// ── Init ───────────────────────────────────────────────────

const style = document.createElement("style");
style.textContent = `
  .active-type { background: rgba(155,28,28,.10); border-color: rgba(155,28,28,.28); color: #7f1d1d; }
  .active-method { background: rgba(155,28,28,.10); border-color: rgba(155,28,28,.28); color: #7f1d1d; }
`;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("payDate").valueAsDate = new Date();
  syncClientTypeUI();
  try {
    await Promise.all([loadIndividualClients(), loadPartnerClients(), loadPayments()]);
  } catch(e) {
    toast(`Failed to load: ${e.message}`);
  }
});
