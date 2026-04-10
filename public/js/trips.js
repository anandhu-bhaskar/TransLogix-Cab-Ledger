function money(n) {
  return `£${(Number(n) || 0).toFixed(2)}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function apiJson(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || res.statusText);
  }
  return res.json();
}

const STATE = { routes: [], workers: [], individualClients: [], businessClients: [] };

// ── Helpers ──────────────────────────────────────────────

function selectedWorkerIds() {
  return Array.from(document.querySelectorAll("#workersBox .chip.active"))
    .filter(el => el.dataset.id && el.dataset.id !== "other" && el.dataset.id !== "unspecified")
    .map(el => el.dataset.id);
}

function isUnspecified() {
  return !!document.querySelector("#workersBox .chip[data-id='unspecified'].active");
}

function isOtherWorkers() {
  return !!document.querySelector("#workersBox .chip[data-id='other'].active");
}

function selectedPayerIds() {
  return Array.from(document.querySelectorAll("#payersBox .chip.active")).map(el => el.dataset.id);
}

function autoFillPeopleCount() {
  if (isUnspecified()) return; // manual only when unspecified
  const namedIds = selectedWorkerIds().length;
  const customNames = isOtherWorkers()
    ? (document.getElementById("otherNames")?.value || "").split(",").map(s => s.trim()).filter(Boolean).length
    : 0;
  const total = namedIds + customNames;
  const field = document.getElementById("numberOfPeople");
  if (total > 0) field.value = total;
  else field.value = "";
}

function getPeopleCount() {
  const field = Number(document.getElementById("numberOfPeople").value);
  return field || 0;
}

function updatePerPayer() {
  const total = Number(document.getElementById("totalAmount").value) || 0;
  const paymentMethod = document.getElementById("paymentMethod").value;
  let count = 0;
  if (paymentMethod === "direct") {
    count = selectedPayerIds().length;
  } else {
    count = getPeopleCount() || selectedWorkerIds().length;
  }
  const per = count ? Number((total / count).toFixed(2)) : 0;
  document.getElementById("amountPerPayer").textContent = money(per);
}

// ── Render ────────────────────────────────────────────────

function renderWorkerChips() {
  const box = document.getElementById("workersBox");
  box.innerHTML = "";

  // Regular worker chips
  STATE.workers.forEach(w => {
    const el = document.createElement("div");
    el.className = "chip";
    el.dataset.id = w._id;
    el.textContent = w.name;
    el.addEventListener("click", () => {
      const unspecChip = box.querySelector("[data-id='unspecified']");
      if (unspecChip) unspecChip.classList.remove("active");
      el.classList.toggle("active");
      autoFillPeopleCount();
      updatePerPayer();
    });
    box.appendChild(el);
  });

  // Other chip
  const otherChip = document.createElement("div");
  otherChip.className = "chip";
  otherChip.dataset.id = "other";
  otherChip.textContent = "Other…";
  otherChip.addEventListener("click", () => {
    const unspecChip = box.querySelector("[data-id='unspecified']");
    if (unspecChip) unspecChip.classList.remove("active");
    otherChip.classList.toggle("active");
    document.getElementById("otherNamesWrap").style.display = isOtherWorkers() ? "block" : "none";
    autoFillPeopleCount();
    updatePerPayer();
  });
  box.appendChild(otherChip);

  // Unspecified chip
  const unspecChip = document.createElement("div");
  unspecChip.className = "chip";
  unspecChip.dataset.id = "unspecified";
  unspecChip.textContent = "Unspecified";
  unspecChip.addEventListener("click", () => {
    const wasActive = unspecChip.classList.contains("active");
    box.querySelectorAll(".chip.active").forEach(c => c.classList.remove("active"));
    document.getElementById("otherNamesWrap").style.display = "none";
    if (!wasActive) unspecChip.classList.add("active");
    // clear auto-fill so user enters manually
    document.getElementById("numberOfPeople").value = "";
    updatePerPayer();
  });
  box.appendChild(unspecChip);
}

function renderPayerChips() {
  const box = document.getElementById("payersBox");
  box.innerHTML = "";
  STATE.individualClients.forEach(c => {
    const el = document.createElement("div");
    el.className = "chip";
    el.dataset.id = c._id;
    el.textContent = `${c.name}${c.amountOwed > 0 ? ` (${money(c.amountOwed)})` : ""}`;
    el.addEventListener("click", () => { el.classList.toggle("active"); updatePerPayer(); });
    box.appendChild(el);
  });
}

function renderRoutes() {
  const sel = document.getElementById("routeId");
  sel.innerHTML = `<option value="">Select route…</option>`;
  STATE.routes.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r._id;
    opt.textContent = r.name;
    sel.appendChild(opt);
  });
  const other = document.createElement("option");
  other.value = "other";
  other.textContent = "Other…";
  sel.appendChild(other);
}

function renderVariants() {
  const routeId = document.getElementById("routeId").value;
  const route = STATE.routes.find(r => r._id === routeId);
  const sel = document.getElementById("variant");
  sel.innerHTML = `<option value="">—</option>`;
  const vars = route && Array.isArray(route.variants) ? route.variants : [];
  vars.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function renderPartners() {
  const sel = document.getElementById("partnerClientId");
  sel.innerHTML = `<option value="">Select partner…</option>`;
  STATE.businessClients.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c._id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function syncRouteUI() {
  const isOther = document.getElementById("routeId").value === "other";
  document.getElementById("customRouteWrap").style.display = isOther ? "block" : "none";
  document.getElementById("variantWrap").style.display = isOther ? "none" : "block";
}

function syncPaymentUI() {
  const method = document.getElementById("paymentMethod").value;
  document.getElementById("directWrap").style.display = method === "direct" ? "block" : "none";
  document.getElementById("partnerWrap").style.display = method === "partner" ? "block" : "none";
  updatePerPayer();
}

function setPaymentMethod(method) {
  document.getElementById("paymentMethod").value = method;
  document.querySelectorAll(".pay-method-btn").forEach(btn => {
    btn.classList.toggle("active-method", btn.dataset.method === method);
  });
  syncPaymentUI();
}

// ── Load ──────────────────────────────────────────────────

async function loadFormData() {
  const [routes, workers, individualClients, businessClients] = await Promise.all([
    apiJson("/api/routes"),
    apiJson("/api/workers"),
    apiJson("/api/individual-clients"),
    apiJson("/api/business-clients")
  ]);
  STATE.routes = routes;
  STATE.workers = workers;
  STATE.individualClients = individualClients;
  STATE.businessClients = businessClients;

  renderRoutes();
  renderVariants();
  renderWorkerChips();
  renderPayerChips();
  renderPartners();
  syncRouteUI();
  syncPaymentUI();
}

async function loadTrips() {
  const trips = await apiJson("/api/trips");
  const tbody = document.getElementById("tripsTbody");
  tbody.innerHTML = "";

  if (!trips.length) {
    document.getElementById("tripsEmpty").style.display = "block";
    return;
  }
  document.getElementById("tripsEmpty").style.display = "none";

  trips.slice(0, 50).forEach(t => {
    // Route label
    const routeLabel = t.customRouteName
      ? t.customRouteName
      : t.route
        ? (t.variant ? `${t.route.name} — ${t.variant}` : t.route.name)
        : "—";

    // Workers
    let workerNames;
    if (t.unspecifiedWorkers) {
      workerNames = "<span class='pill' style='font-size:11px'>Unspecified</span>";
    } else {
      const fromDb = Array.isArray(t.workers) ? t.workers.map(w => w.name) : [];
      const fromCustom = Array.isArray(t.customWorkerNames) ? t.customWorkerNames : [];
      const all = [...fromDb, ...fromCustom];
      workerNames = all.length ? escapeHtml(all.join(", ")) : "—";
    }

    // Payment summary
    let paymentLabel = "";
    if (t.paymentMethod === "direct") {
      const payerNames = Array.isArray(t.payers) && t.payers.length
        ? t.payers.map(p => p.client ? p.client.name : "?").join(", ")
        : "—";
      paymentLabel = `<span class="pill" style="font-size:11px">Direct</span> ${escapeHtml(payerNames)}`;
    } else if (t.paymentMethod === "partner") {
      const partnerName = t.businessClient ? t.businessClient.name : "Partner";
      paymentLabel = `<span class="pill bad" style="font-size:11px">Partner</span> ${escapeHtml(partnerName)}`;
    } else {
      // legacy
      paymentLabel = t.payerType === "business"
        ? `<span class="pill bad" style="font-size:11px">Partner</span> ${escapeHtml(t.businessClient?.name || "")}`
        : `<span class="pill" style="font-size:11px">Direct</span> ${escapeHtml(t.individualClient?.name || "")}`;
    }

    const peopleCount = t.numberOfPeople
      || (Array.isArray(t.workers) ? t.workers.length : 0)
      + (Array.isArray(t.customWorkerNames) ? t.customWorkerNames.length : 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(t.date)}</td>
      <td>${escapeHtml(routeLabel)}</td>
      <td>${workerNames}</td>
      <td>${peopleCount || "—"}</td>
      <td>${paymentLabel}</td>
      <td>${money(t.totalAmount)}</td>
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
        await Promise.all([loadTrips(), loadFormData()]);
      } catch (e) {
        toast(`Delete failed: ${e.message}`);
      }
    });
  });
}

// ── Submit ────────────────────────────────────────────────

async function onSubmit(e) {
  e.preventDefault();

  const date = document.getElementById("date").value;
  const routeId = document.getElementById("routeId").value;
  const customRouteName = document.getElementById("customRouteName").value.trim();
  const variant = document.getElementById("variant").value;
  const workerIds = selectedWorkerIds();
  const numberOfPeople = Number(document.getElementById("numberOfPeople").value) || undefined;
  const unspecifiedWorkers = isUnspecified();
  const customWorkerNames = isOtherWorkers()
    ? document.getElementById("otherNames").value.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  const totalAmount = Number(document.getElementById("totalAmount").value);
  const notes = document.getElementById("notes").value;
  const paymentMethod = document.getElementById("paymentMethod").value;
  const payerClientIds = selectedPayerIds();
  const partnerClientId = document.getElementById("partnerClientId").value;

  if (!routeId) return toast("Please select a route.");
  if (routeId === "other" && !customRouteName) return toast("Please enter a custom route name.");
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return toast("Please enter a valid total amount.");

  if (paymentMethod === "direct" && !payerClientIds.length)
    return toast("Please select at least one paying client.");
  if (paymentMethod === "partner" && !partnerClientId)
    return toast("Please select a partner.");

  const payload = {
    date,
    routeId,
    customRouteName,
    variant,
    workerIds,
    customWorkerNames,
    unspecifiedWorkers,
    numberOfPeople,
    totalAmount,
    notes,
    paymentMethod,
    payerClientIds: paymentMethod === "direct" ? payerClientIds : [],
    partnerClientId: paymentMethod === "partner" ? partnerClientId : undefined
  };

  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  try {
    await apiJson("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    toast("Trip saved.");
    resetForm();
    await Promise.all([loadTrips(), loadFormData()]);
  } catch (err) {
    toast(`Save failed: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

function resetForm() {
  document.getElementById("tripForm").reset();
  document.getElementById("date").valueAsDate = new Date();
  document.querySelectorAll(".chip.active").forEach(c => c.classList.remove("active"));
  document.getElementById("otherNamesWrap").style.display = "none";
  document.getElementById("otherNames").value = "";
  document.getElementById("numberOfPeople").value = "";
  renderVariants();
  syncRouteUI();
  setPaymentMethod("direct");
  updatePerPayer();
}

// ── Init ──────────────────────────────────────────────────

// Active method button styling
const style = document.createElement("style");
style.textContent = `.active-method { background: rgba(155,28,28,.10); border-color: rgba(155,28,28,.28); color: #7f1d1d; }`;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("date").valueAsDate = new Date();

  document.getElementById("routeId").addEventListener("change", () => {
    syncRouteUI();
    renderVariants();
  });

  document.getElementById("totalAmount").addEventListener("input", updatePerPayer);
  document.getElementById("numberOfPeople").addEventListener("input", updatePerPayer);
  document.getElementById("otherNames").addEventListener("input", () => { autoFillPeopleCount(); updatePerPayer(); });
  document.getElementById("tripForm").addEventListener("submit", onSubmit);
  document.getElementById("resetBtn").addEventListener("click", resetForm);
  document.getElementById("refreshBtn").addEventListener("click", () =>
    loadTrips().catch(e => toast(e.message))
  );

  document.querySelectorAll(".pay-method-btn").forEach(btn => {
    btn.addEventListener("click", () => setPaymentMethod(btn.dataset.method));
  });

  try {
    await loadFormData();
    await loadTrips();
  } catch (e) {
    toast(`Failed to load: ${e.message}`);
  }
});
