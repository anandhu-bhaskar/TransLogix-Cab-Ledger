function money(n) { return `£${(Number(n) || 0).toFixed(2)}`; }
function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? "" : d.toISOString().slice(0, 10); }
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
function escapeHtml(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
async function apiJson(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || res.statusText); }
  return res.json();
}

const STATE = { workers: [], places: [], individualClients: [], businessClients: [], settings: {} };

// ── View switching ────────────────────────────────────────

function showView(name) {
  document.getElementById("viewLedger").style.display  = name === "ledger"  ? "" : "none";
  document.getElementById("viewAddTrip").style.display = name === "addTrip" ? "" : "none";
  document.getElementById("viewWa").style.display      = name === "wa"      ? "" : "none";
}

// ── Place dropdowns ───────────────────────────────────────

function renderPlaceSelect(selId, customId, defaultVal) {
  const sel = document.getElementById(selId);
  const cur = sel.value || defaultVal || "";
  sel.innerHTML = `<option value="">Select…</option>`;
  STATE.places.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    if (p.name === cur) opt.selected = true;
    sel.appendChild(opt);
  });
  const other = document.createElement("option");
  other.value = "__other__";
  other.textContent = "Other…";
  sel.appendChild(other);

  // Show/hide custom input
  const isOther = sel.value === "__other__";
  document.getElementById(customId).style.display = isOther ? "block" : "none";
}

function renderPlaceDropdowns() {
  renderPlaceSelect("originSel", "originCustom", "Coventry");
  renderPlaceSelect("destinationSel", "destinationCustom", "");
}

function getPlaceValue(selId, customId) {
  const val = document.getElementById(selId).value;
  if (val === "__other__") return document.getElementById(customId).value.trim();
  return val;
}

async function ensurePlace(name) {
  if (!name) return;
  if (STATE.places.find(p => p.name.toLowerCase() === name.toLowerCase())) return;
  try {
    const created = await apiJson("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    STATE.places.push(created);
    STATE.places.sort((a, b) => a.name.localeCompare(b.name));
    renderPlaceDropdowns();
  } catch {}
}

// ── Worker / payer chips ──────────────────────────────────

function selectedWorkerIds() {
  return Array.from(document.querySelectorAll("#workersBox .chip.active"))
    .filter(el => el.dataset.id && el.dataset.id !== "other" && el.dataset.id !== "unspecified")
    .map(el => el.dataset.id);
}
function isUnspecified() { return !!document.querySelector("#workersBox .chip[data-id='unspecified'].active"); }
function isOtherWorkers() { return !!document.querySelector("#workersBox .chip[data-id='other'].active"); }

function selectedPayers() {
  return Array.from(document.querySelectorAll("#payersBox .chip.active")).map(el => ({
    clientId: el.dataset.clientId || null, name: el.dataset.name
  }));
}

function autoFillPeopleCount() {
  if (isUnspecified()) return;
  const named = selectedWorkerIds().length;
  const custom = isOtherWorkers()
    ? (document.getElementById("otherNames").value || "").split(",").map(s => s.trim()).filter(Boolean).length
    : 0;
  const total = named + custom;
  document.getElementById("numberOfPeople").value = total > 0 ? total : "";
}

function updatePerPayer() {
  const total = Number(document.getElementById("totalAmount").value) || 0;
  const method = document.getElementById("paymentMethod").value;
  const count = method === "direct"
    ? selectedPayers().length
    : Number(document.getElementById("numberOfPeople").value) || selectedWorkerIds().length;
  document.getElementById("amountPerPayer").textContent = money(count ? total / count : 0);
}

function renderWorkerChips() {
  const box = document.getElementById("workersBox");
  box.innerHTML = "";

  STATE.workers.forEach(w => {
    const el = document.createElement("div");
    el.className = "chip"; el.dataset.id = w._id; el.textContent = w.name;
    el.addEventListener("click", () => {
      box.querySelector("[data-id='unspecified']")?.classList.remove("active");
      el.classList.toggle("active");
      autoFillPeopleCount(); rebuildPayerChips();
    });
    box.appendChild(el);
  });

  const otherChip = document.createElement("div");
  otherChip.className = "chip"; otherChip.dataset.id = "other"; otherChip.textContent = "Other…";
  otherChip.addEventListener("click", () => {
    box.querySelector("[data-id='unspecified']")?.classList.remove("active");
    otherChip.classList.toggle("active");
    document.getElementById("otherNamesWrap").style.display = isOtherWorkers() ? "block" : "none";
    autoFillPeopleCount(); rebuildPayerChips();
  });
  box.appendChild(otherChip);

  const unspecChip = document.createElement("div");
  unspecChip.className = "chip"; unspecChip.dataset.id = "unspecified"; unspecChip.textContent = "Unspecified";
  unspecChip.addEventListener("click", () => {
    const was = unspecChip.classList.contains("active");
    box.querySelectorAll(".chip.active").forEach(c => c.classList.remove("active"));
    document.getElementById("otherNamesWrap").style.display = "none";
    if (!was) unspecChip.classList.add("active");
    document.getElementById("numberOfPeople").value = "";
    rebuildPayerChips();
  });
  box.appendChild(unspecChip);
}

function rebuildPayerChips() {
  const box = document.getElementById("payersBox");
  const note = document.getElementById("payersNote");
  box.innerHTML = "";

  const selectedWorkers = Array.from(document.querySelectorAll("#workersBox .chip.active"))
    .filter(c => c.dataset.id !== "unspecified" && c.dataset.id !== "other");

  const otherNames = isOtherWorkers()
    ? (document.getElementById("otherNames").value || "").split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const allNames = [];
  selectedWorkers.forEach(chip => {
    const worker = STATE.workers.find(w => w._id === chip.dataset.id);
    if (!worker) return;
    const match = STATE.individualClients.find(c => c.name.toLowerCase() === worker.name.toLowerCase());
    allNames.push({ name: worker.name, clientId: match?._id || null });
  });
  otherNames.forEach(name => {
    const match = STATE.individualClients.find(c => c.name.toLowerCase() === name.toLowerCase());
    allNames.push({ name, clientId: match?._id || null });
  });

  if (!allNames.length) { note.textContent = "Select people on trip first."; updatePerPayer(); return; }
  note.textContent = "Deselect anyone not paying. Amount splits equally among selected.";

  allNames.forEach(({ name, clientId }) => {
    const el = document.createElement("div");
    el.className = "chip active";
    el.dataset.clientId = clientId || ""; el.dataset.name = name;
    el.textContent = name + (clientId ? "" : " ⚠");
    if (!clientId) el.title = "No client record — won't track balance";
    el.addEventListener("click", () => { el.classList.toggle("active"); updatePerPayer(); });
    box.appendChild(el);
  });
  updatePerPayer();
}

function renderPartners() {
  const sel = document.getElementById("partnerClientId");
  sel.innerHTML = `<option value="">Select partner…</option>`;
  STATE.businessClients.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c._id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function syncPaymentUI() {
  const method = document.getElementById("paymentMethod").value;
  document.getElementById("directWrap").style.display  = method === "direct"  ? "block" : "none";
  document.getElementById("partnerWrap").style.display = method === "partner" ? "block" : "none";
  updatePerPayer();
}

function setPaymentMethod(method) {
  document.getElementById("paymentMethod").value = method;
  document.querySelectorAll(".pay-method-btn").forEach(btn =>
    btn.classList.toggle("active-method", btn.dataset.method === method)
  );
  syncPaymentUI();
}

// ── Load data ─────────────────────────────────────────────

async function loadFormData() {
  const [workers, places, individualClients, businessClients, settings] = await Promise.all([
    apiJson("/api/workers"),
    apiJson("/api/places"),
    apiJson("/api/individual-clients"),
    apiJson("/api/business-clients"),
    apiJson("/api/settings").catch(() => ({}))
  ]);
  STATE.workers = workers;
  STATE.places = places;
  STATE.individualClients = individualClients;
  STATE.businessClients = businessClients;
  STATE.settings = settings;

  renderPlaceDropdowns();
  renderWorkerChips();
  renderPartners();
  syncPaymentUI();
  rebuildPayerChips();
}

async function loadTrips() {
  const trips = await apiJson("/api/trips");
  const tbody = document.getElementById("tripsTbody");
  tbody.innerHTML = "";

  if (!trips.length) { document.getElementById("tripsEmpty").style.display = "block"; return; }
  document.getElementById("tripsEmpty").style.display = "none";

  trips.slice(0, 50).forEach(t => {
    const routeLabel = t.origin && t.destination
      ? `${t.origin} → ${t.destination}`
      : t.customRouteName || (t.route ? t.route.name : "—");

    let workerNames;
    if (t.unspecifiedWorkers) {
      workerNames = "<span class='pill' style='font-size:11px'>Unspecified</span>";
    } else {
      const all = [
        ...(Array.isArray(t.workers) ? t.workers.map(w => w.name) : []),
        ...(Array.isArray(t.customWorkerNames) ? t.customWorkerNames : [])
      ];
      workerNames = all.length ? escapeHtml(all.join(", ")) : "—";
    }

    let paymentLabel = "";
    if (t.paymentMethod === "direct") {
      const names = Array.isArray(t.payers) && t.payers.length
        ? t.payers.map(p => p.client?.name || "?").join(", ") : "—";
      paymentLabel = `<span class="pill" style="font-size:11px">Direct</span> ${escapeHtml(names)}`;
    } else if (t.paymentMethod === "partner") {
      paymentLabel = `<span class="pill bad" style="font-size:11px">Partner</span> ${escapeHtml(t.businessClient?.name || "Partner")}`;
    } else {
      paymentLabel = t.payerType === "business"
        ? `<span class="pill bad" style="font-size:11px">Partner</span> ${escapeHtml(t.businessClient?.name || "")}`
        : `<span class="pill" style="font-size:11px">Direct</span> ${escapeHtml(t.individualClient?.name || "")}`;
    }

    const people = t.numberOfPeople
      || (Array.isArray(t.workers) ? t.workers.length : 0)
      + (Array.isArray(t.customWorkerNames) ? t.customWorkerNames.length : 0);
    const parking = Number(t.parkingCharges) || 0;
    const extras  = Number(t.otherExpenses)  || 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(t.date)}</td>
      <td>${escapeHtml(routeLabel)}</td>
      <td>${escapeHtml(t.variant || "—")}</td>
      <td>${workerNames}</td>
      <td>${people || "—"}</td>
      <td>${paymentLabel}</td>
      <td>${money(t.totalAmount)}</td>
      <td>${parking ? money(parking) : "—"}</td>
      <td>${extras  ? money(extras)  : "—"}</td>
      <td style="text-align:right">
        <button class="btn small" data-del="${t._id}" type="button">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this trip? Balances will be reversed.")) return;
      try {
        await apiJson(`/api/trips/${btn.dataset.del}`, { method: "DELETE" });
        toast("Trip deleted.");
        loadTrips();
      } catch (e) { toast(`Delete failed: ${e.message}`); }
    });
  });
}

// ── Submit ────────────────────────────────────────────────

async function onSubmit(e) {
  e.preventDefault();

  const date    = document.getElementById("date").value;
  const origin  = getPlaceValue("originSel", "originCustom");
  const destination = getPlaceValue("destinationSel", "destinationCustom");
  const variant = document.getElementById("variant").value;
  const workerIds = selectedWorkerIds();
  const numberOfPeople = Number(document.getElementById("numberOfPeople").value) || undefined;
  const unspecifiedWorkers = isUnspecified();
  const customWorkerNames = isOtherWorkers()
    ? document.getElementById("otherNames").value.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  const totalAmount    = Number(document.getElementById("totalAmount").value);
  const parkingCharges = Number(document.getElementById("parkingCharges").value) || 0;
  const otherExpenses  = Number(document.getElementById("otherExpenses").value)  || 0;
  const notes          = document.getElementById("notes").value;
  const paymentMethod  = document.getElementById("paymentMethod").value;
  const payers         = selectedPayers();
  const partnerClientId = document.getElementById("partnerClientId").value;
  const includeBankDetails = document.getElementById("includeBankDetails").checked;

  if (!origin)      return toast("Please select or enter the origin (From).");
  if (!destination) return toast("Please select or enter the destination (To).");
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return toast("Please enter a valid total amount.");
  if (paymentMethod === "direct" && !payers.length)
    return toast("Select people on trip first — they will appear as payers.");
  if (paymentMethod === "partner" && !partnerClientId)
    return toast("Please select a partner.");

  const payerClientIds = payers.map(p => p.clientId).filter(Boolean);
  const untracked = payers.filter(p => !p.clientId).map(p => p.name);
  if (paymentMethod === "direct" && untracked.length) {
    if (!confirm(`${untracked.join(", ")} have no client record and won't be tracked. Continue anyway?`)) return;
  }

  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  try {
    // Save any new custom places first
    await ensurePlace(origin);
    await ensurePlace(destination);

    const saved = await apiJson("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date, origin, destination, variant,
        workerIds, customWorkerNames, unspecifiedWorkers, numberOfPeople,
        totalAmount, parkingCharges, otherExpenses, notes,
        paymentMethod,
        payerClientIds: paymentMethod === "direct" ? payerClientIds : [],
        partnerClientId: paymentMethod === "partner" ? partnerClientId : undefined
      })
    });

    resetForm();
    loadTrips();
    buildWaView(saved, includeBankDetails);
    showView("wa");

  } catch (err) {
    toast(`Save failed: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

// ── WhatsApp view ─────────────────────────────────────────

function buildWaMessage(client, trip, includeBankDetails) {
  const routeLabel = trip.origin && trip.destination
    ? `${trip.origin} → ${trip.destination}`
    : trip.customRouteName || (trip.route ? trip.route.name : "—");
  const dateLabel = new Date(trip.date).toISOString().slice(0, 10);
  const amountEach = trip.amountPerPerson
    || (trip.payers?.length ? Number((trip.totalAmount / trip.payers.length).toFixed(2)) : trip.totalAmount);

  let msg =
    `Hi ${client.name}, a trip has been recorded for you.\n` +
    `Date: ${dateLabel}\n` +
    `Route: ${routeLabel}\n` +
    `Amount: £${Number(amountEach).toFixed(2)}`;

  if (includeBankDetails) {
    const s = STATE.settings;
    const parts = [];
    if (s.bankName)      parts.push(`Bank: ${s.bankName}`);
    if (s.accountNumber) parts.push(`Account: ${s.accountNumber}`);
    if (s.sortCode)      parts.push(`Sort code: ${s.sortCode}`);
    if (parts.length) msg += `\n\nPayment details:\n${parts.join("\n")}`;
  }

  return msg;
}

function buildWaView(trip, includeBankDetails) {
  const body = document.getElementById("waPanelBody");
  body.innerHTML = "";

  const targets = trip.paymentMethod === "direct" && Array.isArray(trip.payers)
    ? trip.payers.map(p => p.client).filter(c => c?.whatsappNumber)
    : [];

  if (!targets.length) {
    body.innerHTML = `<div class="footer-note">No phone numbers found for paying clients — nothing to send.</div>`;
    return;
  }

  targets.forEach(client => {
    const num = client.whatsappNumber.replace(/[^\d]/g, "");
    if (!num) return;
    const msg = buildWaMessage(client, trip, includeBankDetails);
    const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;

    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)";
    row.innerHTML = `
      <div>
        <div style="font-weight:700;font-size:14px">${escapeHtml(client.name)}</div>
        <div class="footer-note">${escapeHtml(client.whatsappNumber)}</div>
      </div>
      <a href="${url}" target="_blank" rel="noreferrer" class="btn wa small">Send via WhatsApp</a>
    `;
    body.appendChild(row);
  });
}

// ── Reset form ────────────────────────────────────────────

function resetForm() {
  document.getElementById("tripForm").reset();
  document.getElementById("date").valueAsDate = new Date();
  document.getElementById("includeBankDetails").checked = false;
  document.querySelectorAll(".chip.active").forEach(c => c.classList.remove("active"));
  document.getElementById("otherNamesWrap").style.display = "none";
  document.getElementById("otherNames").value = "";
  document.getElementById("numberOfPeople").value = "";
  // Reset dropdowns to defaults
  renderPlaceDropdowns();
  // Force Coventry as origin default
  document.getElementById("originSel").value = "Coventry";
  document.getElementById("originCustom").style.display = "none";
  document.getElementById("destinationSel").value = "";
  document.getElementById("destinationCustom").style.display = "none";
  setPaymentMethod("direct");
  rebuildPayerChips();
}

// ── Init ──────────────────────────────────────────────────

const style = document.createElement("style");
style.textContent = `.active-method { background:rgba(155,28,28,.10); border-color:rgba(155,28,28,.28); color:#7f1d1d; }`;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", async () => {
  // View controls
  document.getElementById("addTripBtn").addEventListener("click", () => showView("addTrip"));
  document.getElementById("backFromFormBtn").addEventListener("click", () => showView("ledger"));
  document.getElementById("addAnotherBtn").addEventListener("click", () => showView("addTrip"));
  document.getElementById("goBackBtn").addEventListener("click", () => showView("ledger"));
  document.getElementById("refreshBtn").addEventListener("click", () => loadTrips().catch(e => toast(e.message)));

  // Place dropdowns: show/hide custom input on "Other..." selection
  ["originSel", "destinationSel"].forEach(selId => {
    const customId = selId === "originSel" ? "originCustom" : "destinationCustom";
    document.getElementById(selId).addEventListener("change", () => {
      document.getElementById(customId).style.display =
        document.getElementById(selId).value === "__other__" ? "block" : "none";
    });
  });

  // Swap button
  document.getElementById("swapBtn").addEventListener("click", () => {
    const oSel = document.getElementById("originSel");
    const dSel = document.getElementById("destinationSel");
    const oCustom = document.getElementById("originCustom");
    const dCustom = document.getElementById("destinationCustom");

    // Swap select values
    [oSel.value, dSel.value] = [dSel.value, oSel.value];
    // Swap custom text
    [oCustom.value, dCustom.value] = [dCustom.value, oCustom.value];
    // Sync visibility
    oCustom.style.display = oSel.value === "__other__" ? "block" : "none";
    dCustom.style.display = dSel.value === "__other__" ? "block" : "none";
  });

  document.getElementById("totalAmount").addEventListener("input", updatePerPayer);
  document.getElementById("numberOfPeople").addEventListener("input", updatePerPayer);
  document.getElementById("otherNames").addEventListener("input", () => { autoFillPeopleCount(); rebuildPayerChips(); });
  document.getElementById("tripForm").addEventListener("submit", onSubmit);

  document.querySelectorAll(".pay-method-btn").forEach(btn =>
    btn.addEventListener("click", () => setPaymentMethod(btn.dataset.method))
  );

  try {
    await loadFormData();
    await loadTrips();
  } catch (e) {
    toast(`Failed to load: ${e.message}`);
  }

  // Default: show ledger
  showView("ledger");
});
