let currentFilter = "all";
let allClients = [];

function money(n) {
  return `£${(Number(n) || 0).toFixed(2)}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || res.statusText);
  }
  return res.json();
}

function buildWhatsAppUrl(client) {
  const num = (client.whatsappNumber || "").replace(/[^\d]/g, "");
  if (!num) return "";
  const msg =
    `Hi ${client.name}, you have an outstanding balance of ${money(client.amountOwed)}.\n` +
    `Please arrange payment at your earliest convenience.\nThank you 🙏`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

function filterClients() {
  if (currentFilter === "all") return allClients;
  if (currentFilter === "unpaid") return allClients.filter(c => c.status === "unpaid");
  if (currentFilter === "paid") return allClients.filter(c => c.status === "paid");
  if (currentFilter === "direct") return allClients.filter(c => (c.clientType || "direct") === "direct");
  if (currentFilter === "partner") return allClients.filter(c => c.clientType === "partner");
  return allClients;
}

function renderClients() {
  const tbody = document.getElementById("clientsTbody");
  const empty = document.getElementById("clientsEmpty");

  const filtered = filterClients();

  tbody.innerHTML = "";

  if (!filtered.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  filtered.forEach(c => {
    const waUrl = buildWhatsAppUrl(c);
    const isPaid = c.status === "paid";
    const typeLabel = c.clientType === "partner" ? "Partner" : "Direct";
    const typePill = c.clientType === "partner"
      ? `<span class="pill bad" style="font-size:11px">${typeLabel}</span>`
      : `<span class="pill" style="font-size:11px">${typeLabel}</span>`;

    let orgLabel = escapeHtml(c.organisation || "—");
    if (c.organisation === "Carehome" && c.carehomeLocation) {
      orgLabel = `Carehome — ${escapeHtml(c.carehomeLocation)}`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td>${typePill}</td>
      <td>${orgLabel}</td>
      <td>${escapeHtml(c.postcode || "—")}</td>
      <td>${escapeHtml(c.whatsappNumber || "—")}</td>
      <td><span class="pill ${isPaid ? "good" : c.amountOwed > 0 ? "bad" : ""}">${money(c.amountOwed)}</span></td>
      <td>
        <button class="btn small toggle-status" data-id="${c._id}" data-status="${c.status}" type="button">
          ${isPaid ? "Mark unpaid" : "Mark paid"}
        </button>
      </td>
      <td>
        <div class="row" style="gap:6px;justify-content:flex-end">
          ${waUrl
            ? `<a class="btn wa small" href="${waUrl}" target="_blank" rel="noreferrer">WhatsApp</a>`
            : `<span class="pill" style="font-size:11px">No number</span>`
          }
          <button class="btn small delete-client" data-id="${c._id}" data-name="${escapeHtml(c.name)}" type="button">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Status toggle
  tbody.querySelectorAll(".toggle-status").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const current = btn.dataset.status;
      const next = current === "paid" ? "unpaid" : "paid";
      try {
        btn.disabled = true;
        await api(`/api/individual-clients/${id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next })
        });
        await loadClients();
        toast(`Marked as ${next}.`);
      } catch (e) {
        toast(`Error: ${e.message}`);
        btn.disabled = false;
      }
    });
  });

  // Delete
  tbody.querySelectorAll(".delete-client").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Delete "${btn.dataset.name}"? This cannot be undone.`)) return;
      try {
        btn.disabled = true;
        await api(`/api/individual-clients/${btn.dataset.id}`, { method: "DELETE" });
        await loadClients();
        toast("Client deleted.");
      } catch (e) {
        toast(`Error: ${e.message}`);
        btn.disabled = false;
      }
    });
  });
}

function renderKPIs() {
  const total = allClients.length;
  const unpaid = allClients.filter(c => c.status === "unpaid").length;
  const owed = allClients.reduce((s, c) => s + (Number(c.amountOwed) || 0), 0);
  const partners = allClients.filter(c => c.clientType === "partner").length;
  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiUnpaid").textContent = unpaid;
  document.getElementById("kpiOwed").textContent = money(owed);
  document.getElementById("kpiPartners").textContent = partners;
}

async function loadClients() {
  try {
    allClients = await api("/api/individual-clients");
    renderKPIs();
    renderClients();
  } catch (e) {
    toast(`Failed to load clients: ${e.message}`);
  }
}

// Filter buttons
const filterLabels = {
  all: "All clients",
  unpaid: "Unpaid only",
  paid: "Paid only",
  direct: "Direct clients",
  partner: "Partner clients"
};

function setFilter(f) {
  currentFilter = f;
  document.getElementById("listSubtitle").textContent = filterLabels[f] || "All clients";
  ["filterAll", "filterUnpaid", "filterPaid", "filterDirect", "filterPartner"].forEach(id => {
    const key = id.replace("filter", "").toLowerCase();
    document.getElementById(id).classList.toggle("active-filter", key === f);
  });
  renderClients();
}

document.getElementById("filterAll").addEventListener("click", () => setFilter("all"));
document.getElementById("filterUnpaid").addEventListener("click", () => setFilter("unpaid"));
document.getElementById("filterPaid").addEventListener("click", () => setFilter("paid"));
document.getElementById("filterDirect").addEventListener("click", () => setFilter("direct"));
document.getElementById("filterPartner").addEventListener("click", () => setFilter("partner"));
document.getElementById("refreshBtn").addEventListener("click", loadClients);

// Client type toggle
document.querySelectorAll(".client-type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".client-type-btn").forEach(b => b.classList.remove("active-filter"));
    btn.classList.add("active-filter");
    document.getElementById("clientType").value = btn.dataset.type;
  });
});

// Organisation → show/hide carehome location and custom org input
document.getElementById("clientOrganisation").addEventListener("change", () => {
  const val = document.getElementById("clientOrganisation").value;
  document.getElementById("carehomeLocationWrap").style.display = val === "Carehome" ? "block" : "none";
  document.getElementById("customOrgWrap").style.display = val === "Other" ? "block" : "none";
  if (val !== "Carehome") document.getElementById("carehomeLocation").value = "";
  if (val !== "Other") document.getElementById("customOrgName").value = "";
});

// Add client form
document.getElementById("addClientForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("clientName").value.trim();
  const whatsappNumber = document.getElementById("clientWhatsapp").value.trim();
  const postcode = document.getElementById("clientPostcode").value.trim();
  const clientType = document.getElementById("clientType").value;
  const orgSelect = document.getElementById("clientOrganisation").value;
  const customOrgName = document.getElementById("customOrgName").value.trim();
  const organisation = orgSelect === "Other" ? customOrgName : orgSelect;
  const carehomeLocation = organisation === "Carehome"
    ? document.getElementById("carehomeLocation").value
    : "";

  if (!name) return toast("Please enter a name.");
  if (orgSelect === "Other" && !customOrgName) return toast("Please enter the organisation name.");
  if (organisation === "Carehome" && !carehomeLocation) return toast("Please select a Carehome location.");

  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  try {
    await api("/api/individual-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, whatsappNumber, postcode, clientType, organisation, carehomeLocation })
    });
    // Reset form
    document.getElementById("clientName").value = "";
    document.getElementById("clientWhatsapp").value = "";
    document.getElementById("clientPostcode").value = "";
    document.getElementById("clientType").value = "direct";
    document.querySelectorAll(".client-type-btn").forEach(b => {
      b.classList.toggle("active-filter", b.dataset.type === "direct");
    });
    document.getElementById("clientOrganisation").value = "";
    document.getElementById("carehomeLocationWrap").style.display = "none";
    document.getElementById("carehomeLocation").value = "";
    document.getElementById("customOrgWrap").style.display = "none";
    document.getElementById("customOrgName").value = "";
    await loadClients();
    toast(`"${name}" added.`);
  } catch (e) {
    toast(`Error: ${e.message}`);
  } finally {
    btn.disabled = false;
  }
});

// ── VCF parser ────────────────────────────────────────────

function parseVcf(text) {
  const contacts = [];
  const cards = text.split(/BEGIN:VCARD/i).slice(1); // split on each vCard block

  cards.forEach(card => {
    let name = "";
    let phone = "";

    card.split(/\r?\n/).forEach(line => {
      // Full name
      if (/^FN[:;]/i.test(line)) {
        name = line.replace(/^FN[:;][^:]*:/i, "").trim();
      }
      // Phone — grab the first TEL line
      if (!phone && /^TEL[:;]/i.test(line)) {
        phone = line.replace(/^TEL[^:]*:/i, "").replace(/\s+/g, "").trim();
      }
    });

    if (name) contacts.push({ name, phone });
  });

  return contacts;
}

// ── Contact Picker API ─────────────────────────────────────

let pendingImports = [];

// Show native picker button only on Android (Contact Picker API)
if ("contacts" in navigator && "ContactsManager" in window) {
  document.getElementById("importContactsBtn").style.display = "inline-flex";
}

function showImportPreview(contacts) {
  pendingImports = contacts.filter(c => c.name);
  if (!pendingImports.length) return toast("No valid contacts found.");

  const list = document.getElementById("importList");
  list.innerHTML = "";
  pendingImports.forEach((c, i) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0;border-bottom:1px solid #eee";
    row.innerHTML = `
      <input type="checkbox" data-idx="${i}" checked style="width:14px;height:14px;accent-color:#9b1c1c;flex-shrink:0" />
      <span style="flex:1;font-weight:700">${escapeHtml(c.name)}</span>
      <span class="muted">${escapeHtml(c.phone || "No number")}</span>
    `;
    list.appendChild(row);
  });

  document.getElementById("importNote").textContent = "";
  document.getElementById("importPreview").style.display = "block";
}

// Android: Contact Picker API
document.getElementById("importContactsBtn").addEventListener("click", async () => {
  try {
    const raw = await navigator.contacts.select(["name", "tel"], { multiple: true });
    if (!raw.length) return;
    const contacts = raw.map(c => ({
      name: Array.isArray(c.name) ? c.name[0]?.trim() : (c.name || "").trim(),
      phone: Array.isArray(c.tel)  ? c.tel[0]?.replace(/\s+/g, "") : ""
    }));
    showImportPreview(contacts);
  } catch (e) {
    if (e.name !== "AbortError") toast(`Contact picker error: ${e.message}`);
  }
});

// iOS / all platforms: VCF file import
document.getElementById("importVcfFile").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const contacts = [];
  for (const file of files) {
    const text = await file.text();
    contacts.push(...parseVcf(text));
  }

  // Reset input so same file can be re-picked
  e.target.value = "";

  showImportPreview(contacts);
});

document.getElementById("importConfirmBtn").addEventListener("click", async () => {
  const checked = Array.from(document.querySelectorAll("#importList input[type=checkbox]:checked"))
    .map(el => pendingImports[Number(el.dataset.idx)])
    .filter(Boolean);

  if (!checked.length) return toast("No contacts selected.");

  const note = document.getElementById("importNote");
  note.textContent = `Importing ${checked.length} contact(s)…`;
  document.getElementById("importConfirmBtn").disabled = true;

  let imported = 0, skipped = 0;
  for (const c of checked) {
    try {
      await api("/api/individual-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: c.name, whatsappNumber: c.phone || "", clientType: "direct" })
      });
      imported++;
    } catch {
      skipped++; // likely duplicate name
    }
  }

  document.getElementById("importConfirmBtn").disabled = false;
  document.getElementById("importPreview").style.display = "none";
  await loadClients();
  const msg = skipped
    ? `Imported ${imported}, skipped ${skipped} (already exist).`
    : `${imported} contact(s) imported.`;
  toast(msg);
});

document.getElementById("importCancelBtn").addEventListener("click", () => {
  document.getElementById("importPreview").style.display = "none";
  pendingImports = [];
});

// ── Active filter button styling ───────────────────────────

const style = document.createElement("style");
style.textContent = `.active-filter { background: rgba(155,28,28,.10); border-color: rgba(155,28,28,.28); color: #7f1d1d; }`;
document.head.appendChild(style);

loadClients();
