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

function renderClients() {
  const tbody = document.getElementById("clientsTbody");
  const empty = document.getElementById("clientsEmpty");

  const filtered = currentFilter === "all"
    ? allClients
    : allClients.filter(c => c.status === currentFilter);

  tbody.innerHTML = "";

  if (!filtered.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  filtered.forEach(c => {
    const waUrl = buildWhatsAppUrl(c);
    const isPaid = c.status === "paid";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(c.name)}</strong></td>
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
  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiUnpaid").textContent = unpaid;
  document.getElementById("kpiOwed").textContent = money(owed);
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
function setFilter(f) {
  currentFilter = f;
  const subtitles = { all: "All clients", unpaid: "Unpaid only", paid: "Paid only" };
  document.getElementById("listSubtitle").textContent = subtitles[f];
  document.getElementById("filterAll").classList.toggle("active-filter", f === "all");
  document.getElementById("filterUnpaid").classList.toggle("active-filter", f === "unpaid");
  document.getElementById("filterPaid").classList.toggle("active-filter", f === "paid");
  renderClients();
}

document.getElementById("filterAll").addEventListener("click", () => setFilter("all"));
document.getElementById("filterUnpaid").addEventListener("click", () => setFilter("unpaid"));
document.getElementById("filterPaid").addEventListener("click", () => setFilter("paid"));
document.getElementById("refreshBtn").addEventListener("click", loadClients);

// Add client form
document.getElementById("addClientForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("clientName").value.trim();
  const whatsappNumber = document.getElementById("clientWhatsapp").value.trim();
  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  try {
    await api("/api/individual-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, whatsappNumber })
    });
    document.getElementById("clientName").value = "";
    document.getElementById("clientWhatsapp").value = "";
    await loadClients();
    toast(`"${name}" added.`);
  } catch (e) {
    toast(`Error: ${e.message}`);
  } finally {
    btn.disabled = false;
  }
});

// Active filter button styling
const style = document.createElement("style");
style.textContent = `.active-filter { background: rgba(155,28,28,.10); border-color: rgba(155,28,28,.28); color: #7f1d1d; }`;
document.head.appendChild(style);

loadClients();
