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
      const safeUrl  = escapeHtml(p.proof.url);
      const safeName = escapeHtml(p.proof.originalFilename || (isImage ? "proof" : "proof.pdf"));
      proofCell = isImage
        ? `<button class="btn small proof-view-btn" data-url="${safeUrl}" data-type="image" type="button">View</button>`
        : `<button class="btn small proof-view-btn" data-url="${safeUrl}" data-type="pdf" data-name="${safeName}" type="button">PDF</button>`;
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

  tbody.querySelectorAll(".proof-view-btn").forEach(btn => {
    btn.addEventListener("click", () => openLightbox(btn.dataset.url, btn.dataset.type, btn.dataset.name));
  });
}

// ── Lightbox ───────────────────────────────────────────────

function openLightbox(url, type, name) {
  const lb      = document.getElementById("proofLightbox");
  const img     = document.getElementById("lightboxImg");
  const pdfBox  = document.getElementById("lightboxPdf");
  const pdfLink = document.getElementById("lightboxPdfLink");
  const pdfName = document.getElementById("lightboxPdfName");

  if (type === "image") {
    img.src            = url;
    img.style.display  = "block";
    pdfBox.style.display = "none";
  } else {
    img.style.display    = "none";
    pdfBox.style.display = "block";
    pdfLink.href         = url;
    pdfName.textContent  = name || "proof.pdf";
  }
  lb.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const lb = document.getElementById("proofLightbox");
  lb.style.display = "none";
  document.getElementById("lightboxImg").src = "";
  document.body.style.overflow = "";
}

document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
document.getElementById("lightboxBackdrop").addEventListener("click", closeLightbox);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("proofLightbox").style.display !== "none") closeLightbox();
});

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

// ── Proof upload: drag-and-drop + preview ──────────────────

const proofDrop  = document.getElementById("proofDropZone");
const proofInput = document.getElementById("proofFile");

function setProofFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast("File too large — max 5 MB."); return; }

  // Transfer to the hidden input via DataTransfer
  const dt = new DataTransfer();
  dt.items.add(file);
  proofInput.files = dt.files;

  const isImage = file.type.startsWith("image/");
  const isPdf   = file.type === "application/pdf";

  document.getElementById("proofEmpty").style.display   = "none";
  document.getElementById("proofPreview").style.display = "flex";
  document.getElementById("proofName").textContent = file.name;
  document.getElementById("proofSize").textContent = `${(file.size / 1024).toFixed(0)} KB`;

  const thumb   = document.getElementById("proofThumb");
  const pdfIcon = document.getElementById("proofPdfIcon");

  if (isImage) {
    thumb.style.display   = "block";
    pdfIcon.style.display = "none";
    const reader = new FileReader();
    reader.onload = e => { thumb.src = e.target.result; };
    reader.readAsDataURL(file);
  } else if (isPdf) {
    thumb.style.display   = "none";
    pdfIcon.style.display = "block";
  } else {
    thumb.style.display   = "none";
    pdfIcon.style.display = "none";
  }
}

function clearProof() {
  proofInput.value = "";
  document.getElementById("proofEmpty").style.display   = "flex";
  document.getElementById("proofPreview").style.display = "none";
  document.getElementById("proofThumb").src             = "";
  document.getElementById("proofName").textContent      = "";
  document.getElementById("proofSize").textContent      = "";
}

// Click to open file picker
proofDrop.addEventListener("click", (e) => {
  if (e.target.id === "proofClearBtn") return;
  proofInput.click();
});
proofDrop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); proofInput.click(); }
});

proofInput.addEventListener("change", () => {
  if (proofInput.files[0]) setProofFile(proofInput.files[0]);
});

document.getElementById("proofClearBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  clearProof();
});

// Drag-and-drop
proofDrop.addEventListener("dragover", (e) => {
  e.preventDefault();
  proofDrop.classList.add("drag-over");
});
proofDrop.addEventListener("dragleave", () => proofDrop.classList.remove("drag-over"));
proofDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  proofDrop.classList.remove("drag-over");
  const file = e.dataTransfer?.files?.[0];
  if (file) setProofFile(file);
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
  clearProof();
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
