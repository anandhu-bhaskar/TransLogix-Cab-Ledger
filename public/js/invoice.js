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
function money(n) { return `£${(Number(n) || 0).toFixed(2)}`; }
function fmtDate(val) {
  const d = new Date(val);
  return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── State ─────────────────────────────────────────────────
let allInvoiceClients = [];
let adjustments = []; // [{id, label, amount, type: "extra"|"deduction"}]
let adjCounter = 0;

// ── Client dropdown ───────────────────────────────────────
function populateClientDropdown() {
  const type = document.getElementById("invoiceClientType").value;
  const sel  = document.getElementById("clientId");
  const current = sel.value;
  sel.innerHTML = `<option value="">Select client…</option>`;
  const filtered = type === "all" ? allInvoiceClients
    : allInvoiceClients.filter(c => (c.clientType || "direct") === type);
  filtered.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c._id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
  if (current && filtered.find(c => c._id === current)) sel.value = current;
}

async function loadClients() {
  allInvoiceClients = await api("/api/individual-clients");
  populateClientDropdown();
}

// ── Adjustments ───────────────────────────────────────────
function renderAdjList() {
  const list  = document.getElementById("adjList");
  const empty = document.getElementById("adjEmpty");
  list.innerHTML = "";
  empty.style.display = adjustments.length ? "none" : "block";

  adjustments.forEach(adj => {
    const row = document.createElement("div");
    row.style.cssText = "display:grid;grid-template-columns:1fr 90px 80px 28px;gap:6px;align-items:center";
    row.innerHTML = `
      <input type="text" class="input" style="font-size:13px;padding:6px 8px" placeholder="Label (e.g. Discount)"
        value="${adj.label}" data-id="${adj.id}" data-field="label" />
      <input type="number" step="0.01" min="0" class="input" style="font-size:13px;padding:6px 8px"
        placeholder="0.00" value="${adj.amount || ""}" data-id="${adj.id}" data-field="amount" />
      <select class="input" style="font-size:12px;padding:6px 6px" data-id="${adj.id}" data-field="type">
        <option value="deduction" ${adj.type === "deduction" ? "selected" : ""}>Deduction</option>
        <option value="extra"     ${adj.type === "extra"     ? "selected" : ""}>Extra</option>
      </select>
      <button type="button" class="btn small" style="padding:0;width:28px;font-size:15px;line-height:28px;text-align:center"
        data-remove="${adj.id}" title="Remove">×</button>
    `;
    list.appendChild(row);
  });

  // Bind inputs
  list.querySelectorAll("[data-id][data-field]").forEach(el => {
    el.addEventListener("change", () => {
      const adj = adjustments.find(a => a.id === el.dataset.id);
      if (!adj) return;
      if (el.dataset.field === "label")  adj.label  = el.value;
      if (el.dataset.field === "amount") adj.amount = Number(el.value) || 0;
      if (el.dataset.field === "type")   adj.type   = el.value;
    });
  });
  list.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      adjustments = adjustments.filter(a => a.id !== btn.dataset.remove);
      renderAdjList();
    });
  });
}

document.getElementById("addAdjBtn").addEventListener("click", () => {
  adjustments.push({ id: String(++adjCounter), label: "", amount: 0, type: "deduction" });
  renderAdjList();
});

// ── Client type toggle ────────────────────────────────────
document.querySelectorAll(".inv-type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".inv-type-btn").forEach(b => b.classList.remove("active-type"));
    btn.classList.add("active-type");
    document.getElementById("invoiceClientType").value = btn.dataset.type;
    populateClientDropdown();
  });
});

// ── Build invoice HTML ────────────────────────────────────
function buildInvoiceHtml(data, adjs, settings) {
  const { client, trips, payments, previousBalance } = data;
  const prevBal = Number(previousBalance) || 0;

  const tripsTotal    = trips.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const paymentsTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const adjDeductions = adjs.filter(a => a.type === "deduction").reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const adjExtras     = adjs.filter(a => a.type === "extra").reduce((s, a) => s + (Number(a.amount) || 0), 0);

  const balanceAfterPayments = prevBal - paymentsTotal;
  const newCharges = tripsTotal + adjExtras;
  const totalDeductions = adjDeductions;
  const currentBalance = balanceAfterPayments + newCharges - totalDeductions;

  const fromLabel = fmtDate(document.getElementById("fromDate").value);
  const toLabel   = fmtDate(document.getElementById("toDate").value);

  const bizName    = settings.businessName || "Transport Billing";
  const bizAddress = settings.businessAddress || "";
  const bankName   = settings.bankName || "";
  const accountNo  = settings.accountNumber || "";
  const sortCode   = settings.sortCode || "";

  // Table helper
  const thStyle = "padding:8px 10px;background:#f3f4f6;border-bottom:2px solid #ddd;text-align:left;font-weight:700;font-size:12px;white-space:nowrap";
  const tdStyle = "padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top";
  const tdRStyle= tdStyle + ";text-align:right;font-variant-numeric:tabular-nums";

  function table(headers, rows, colStyles = []) {
    const ths = headers.map((h, i) => `<th style="${thStyle};${colStyles[i] || ""}">${h}</th>`).join("");
    const trs = rows.map(cells =>
      `<tr>${cells.map((c, i) => `<td style="${tdStyle};${colStyles[i] || ""}">${c ?? "—"}</td>`).join("")}</tr>`
    ).join("");
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:6px"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  const tripRows = trips.length
    ? trips.map(t => [
        fmtDate(t.date),
        t.origin && t.destination ? `${t.origin} → ${t.destination}` : (t.route || "—"),
        t.variant || "—",
        t.people || "—",
        `<strong>${money(t.amount)}</strong>`
      ])
    : [["—", "No trips in this period", "", "", "—"]];

  const paymentRows = payments.length
    ? payments.map(p => [
        fmtDate(p.date),
        p.method || "—",
        p.paidByName ? `${p.payerName} (via ${p.paidByName})` : p.payerName,
        `<strong style="color:#166534">${money(p.amount)}</strong>`
      ])
    : [["—", "No payments in this period", "", "—"]];

  const adjRows = adjs.filter(a => a.label || a.amount).map(a => [
    a.label || "(unnamed)",
    a.type === "deduction" ? `<span style="color:#166534">−${money(a.amount)}</span>` : `<span style="color:#9b1c1c">+${money(a.amount)}</span>`,
    a.type === "deduction" ? "Deduction" : "Extra charge"
  ]);

  const summaryRows = [
    ["Previous balance", money(prevBal)],
    ["Payments received", `<span style="color:#166534">−${money(paymentsTotal)}</span>`],
    ["Balance after payments", `<strong>${money(balanceAfterPayments)}</strong>`],
    ["New charges (trips)", money(tripsTotal)],
    ...(adjExtras     ? [["Additional charges", `<span style="color:#9b1c1c">+${money(adjExtras)}</span>`]]     : []),
    ...(adjDeductions ? [["Deductions / discounts", `<span style="color:#166534">−${money(adjDeductions)}</span>`]] : []),
    ["<strong>Current balance due</strong>", `<strong style="font-size:15px">${money(currentBalance)}</strong>`]
  ];

  return `
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #111">
      <div>
        <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px">${bizName}</div>
        ${bizAddress ? `<div style="font-size:12px;color:#555;margin-top:3px;white-space:pre-line">${bizAddress}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:900;color:#9b1c1c;letter-spacing:-0.5px">INVOICE</div>
        <div style="font-size:12px;color:#555;margin-top:3px">Period: ${fromLabel} – ${toLabel}</div>
        <div style="font-size:12px;color:#555">Issued: ${fmtDate(new Date())}</div>
      </div>
    </div>

    <!-- Bill To -->
    <div style="margin-bottom:24px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px">Bill To</div>
      <div style="font-size:16px;font-weight:800">${client.name}</div>
      ${client.organisation ? `<div style="font-size:12px;color:#555">${client.organisation}${client.carehomeLocation ? " — " + client.carehomeLocation : ""}</div>` : ""}
      ${client.postcode ? `<div style="font-size:12px;color:#555">${client.postcode}</div>` : ""}
    </div>

    <!-- Section 1: Trips -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px">1. New charges — trips</div>
      ${table(
        ["Date", "Route", "Variant", "People", "Amount"],
        tripRows,
        ["", "", "", "text-align:center", "text-align:right;font-variant-numeric:tabular-nums"]
      )}
    </div>

    <!-- Section 2: Payments -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px">2. Payments received</div>
      ${table(
        ["Date", "Method", "From", "Amount"],
        paymentRows,
        ["", "", "", "text-align:right;font-variant-numeric:tabular-nums"]
      )}
    </div>

    ${adjs.filter(a => a.label || a.amount).length ? `
    <!-- Section 3: Adjustments -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px">3. Adjustments</div>
      ${table(["Description", "Amount", "Type"], adjRows, ["", "text-align:right", ""])}
    </div>` : ""}

    <!-- Section 4: Balance summary -->
    <div style="margin-bottom:${bankName || accountNo ? "24px" : "0"}">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px">${adjs.filter(a=>a.label||a.amount).length ? "4" : "3"}. Balance summary</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;border-radius:8px;overflow:hidden">
        ${summaryRows.map((r, i) => `
          <tr style="${i === summaryRows.length - 1 ? "background:#fef2f2" : ""}">
            <td style="${tdStyle}">${r[0]}</td>
            <td style="${tdRStyle}">${r[1]}</td>
          </tr>`).join("")}
      </table>
    </div>

    ${bankName || accountNo ? `
    <!-- Payment details -->
    <div style="margin-top:24px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px">Payment details</div>
      ${bankName   ? `<div style="font-size:12px"><strong>Bank:</strong> ${bankName}</div>` : ""}
      ${accountNo  ? `<div style="font-size:12px"><strong>Account:</strong> ${accountNo}</div>` : ""}
      ${sortCode   ? `<div style="font-size:12px"><strong>Sort code:</strong> ${sortCode}</div>` : ""}
    </div>` : ""}
  `;
}

// ── Preview button ────────────────────────────────────────
document.getElementById("previewBtn").addEventListener("click", async () => {
  const clientId = document.getElementById("clientId").value;
  const from     = document.getElementById("fromDate").value;
  const to       = document.getElementById("toDate").value;
  const prevBal  = document.getElementById("prevBalance").value || "0";

  if (!clientId) return toast("Please select a client.");
  if (!from || !to) return toast("Please select a date range.");

  const btn = document.getElementById("previewBtn");
  btn.disabled = true; btn.textContent = "Loading…";
  try {
    const [data, settings] = await Promise.all([
      api("/api/invoice/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ individualClientId: clientId, from, to, previousBalance: prevBal })
      }),
      api("/api/settings").catch(() => ({}))
    ]);

    const validAdjs = adjustments.filter(a => a.label && a.amount > 0);
    document.getElementById("invoicePreview").innerHTML = buildInvoiceHtml(data, validAdjs, settings);
    document.getElementById("previewArea").style.display = "block";
    document.getElementById("invoicePreview").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    toast(`Error: ${err.message}`);
  } finally {
    btn.disabled = false; btn.textContent = "Preview invoice";
  }
});

// ── Print ─────────────────────────────────────────────────
document.getElementById("printBtn").addEventListener("click", () => window.print());

// ── Clear ─────────────────────────────────────────────────
document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("clientId").value = "";
  document.getElementById("prevBalance").value = "";
  adjustments = [];
  renderAdjList();
  document.getElementById("previewArea").style.display = "none";

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  document.getElementById("fromDate").value = new Date(y, m, 1).toISOString().slice(0, 10);
  document.getElementById("toDate").value   = new Date(y, m + 1, 0).toISOString().slice(0, 10);
});

// ── Styles ────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  .active-type { background: rgba(155,28,28,.10); border-color: rgba(155,28,28,.28); color: #7f1d1d; }

  @media (max-width: 820px) {
    #invoiceLayout { grid-template-columns: 1fr !important; }
  }

  @media print {
    .no-print, .fx-bg, .toast { display: none !important; }
    body { background: white !important; }
    main.container { padding: 0 !important; margin: 0 !important; max-width: none !important; }
    #invoiceLayout { display: block !important; }
    #invoiceConfig { display: none !important; }
    #previewArea { display: block !important; }
    .no-print { display: none !important; }
    #invoicePreview {
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
    }
  }
`;
document.head.appendChild(style);

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  document.getElementById("fromDate").value = new Date(y, m, 1).toISOString().slice(0, 10);
  document.getElementById("toDate").value   = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  renderAdjList();
  loadClients().catch(e => toast(e.message));
});
