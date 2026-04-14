'use strict';

// ── Utilities ─────────────────────────────────────────────
function money(n) { return `£${(Number(n) || 0).toFixed(2)}`; }
function escapeHtml(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(window.__tt);
  window.__tt = setTimeout(() => el.classList.remove("show"), 3200);
}
async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── State ─────────────────────────────────────────────────
let ALL = { trips: [], payments: [], clients: [], settings: {} };
let PERIOD = 30; // days; 0 = all time
const CH = {};   // chart instances

// ── Chart.js global defaults ──────────────────────────────
Chart.defaults.font.family = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
Chart.defaults.font.size   = 12;
Chart.defaults.color       = "#6b7280";

const TOOLTIP_BASE = {
  backgroundColor: "rgba(17,17,17,0.92)",
  titleColor: "#fff",
  bodyColor: "#d1d5db",
  padding: 10,
  cornerRadius: 8,
  titleFont: { weight: "700", size: 12 },
  bodyFont: { size: 12 }
};

// Palette for routes chart
const PALETTE = [
  "rgba(155,28,28,0.80)", "rgba(37,99,235,0.80)", "rgba(5,150,105,0.80)",
  "rgba(217,119,6,0.80)",  "rgba(124,58,237,0.80)","rgba(8,145,178,0.80)",
  "rgba(219,39,119,0.80)", "rgba(101,163,13,0.80)"
];

// ── Time helpers ──────────────────────────────────────────
function getRange() {
  const now   = new Date();
  let   start;
  if (PERIOD === 0) {
    const stamps = [
      ...ALL.trips.map(t => new Date(t.date).getTime()),
      ...ALL.payments.map(p => new Date(p.date).getTime())
    ];
    start = stamps.length
      ? new Date(Math.min(...stamps))
      : new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getTime() - PERIOD * 86400000);
  }
  return { start, end: now };
}

function inPeriod(items, dateField) {
  const { start } = getRange();
  return items.filter(x => new Date(x[dateField]) >= start);
}

// Generate time buckets (daily / weekly / monthly based on span)
function getBuckets() {
  const { start, end } = getRange();
  const diffDays = (end - start) / 86400000;
  const buckets  = [];

  if (diffDays <= 14) {
    // Daily buckets
    const d = new Date(start); d.setHours(0, 0, 0, 0);
    while (d <= end) {
      const s = new Date(d);
      const e = new Date(d); e.setHours(23, 59, 59, 999);
      buckets.push({
        label: s.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
        start: s, end: e
      });
      d.setDate(d.getDate() + 1);
    }
  } else if (diffDays <= 120) {
    // Weekly (Mon–Sun)
    const d = new Date(start);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    while (d <= end) {
      const s = new Date(d);
      const e = new Date(d); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999);
      buckets.push({
        label: s.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        start: s, end: e
      });
      d.setDate(d.getDate() + 7);
    }
  } else {
    // Monthly
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= end) {
      const s = new Date(d);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({
        label: s.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        start: s, end: e
      });
      d.setMonth(d.getMonth() + 1);
    }
  }
  return buckets;
}

function sumBuckets(items, dateField, valueField, buckets) {
  return buckets.map(b =>
    items
      .filter(x => { const d = new Date(x[dateField]); return d >= b.start && d <= b.end; })
      .reduce((s, x) => s + (Number(x[valueField]) || 0), 0)
  );
}

// ── Chart instance management ─────────────────────────────
function setChartEmpty(canvasId, emptyId, isEmpty) {
  const emptyEl = document.getElementById(emptyId);
  const canvas  = document.getElementById(canvasId);
  if (isEmpty) {
    if (emptyEl) emptyEl.style.display = "flex";
    if (canvas)  canvas.style.display  = "none";
    if (CH[canvasId]) { CH[canvasId].destroy(); delete CH[canvasId]; }
  } else {
    if (emptyEl) emptyEl.style.display = "none";
    if (canvas)  canvas.style.display  = "";
  }
}

function makeChart(canvasId, config) {
  if (CH[canvasId]) { CH[canvasId].destroy(); }
  const canvas = document.getElementById(canvasId);
  CH[canvasId] = new Chart(canvas, config);
}

// ── KPI cards ─────────────────────────────────────────────
function renderKPIs() {
  const trips    = inPeriod(ALL.trips,    "date");
  const payments = inPeriod(ALL.payments, "date");

  const revenue     = trips.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);
  const collected   = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const outstanding = ALL.clients.reduce((s, c) => s + Math.max(Number(c.amountOwed) || 0, 0), 0);
  const unpaidCount = ALL.clients.filter(c => c.status === "unpaid" && (Number(c.amountOwed)||0) > 0).length;
  const paidCount   = ALL.clients.filter(c => c.status === "paid").length;

  const defs = [
    {
      label:    "Still to collect",
      value:    money(outstanding),
      sub:      outstanding > 0
                  ? `Across ${unpaidCount} unpaid client${unpaidCount !== 1 ? "s" : ""}`
                  : "Everyone is paid up!",
      color:    outstanding > 0 ? "#9b1c1c" : "#059669",
      bar:      null,
      highlight: true
    },
    {
      label: "Trips billed",
      value: money(revenue),
      sub:   `${trips.length} trip${trips.length !== 1 ? "s" : ""} in period`,
      color: "#2563eb",
      bar:   revenue,
      max:   Math.max(revenue, collected) || 1
    },
    {
      label: "Money received",
      value: money(collected),
      sub:   `${payments.length} payment${payments.length !== 1 ? "s" : ""}`,
      color: "#059669",
      bar:   collected,
      max:   Math.max(revenue, collected) || 1
    },
    {
      label: "Trips",
      value: trips.length,
      sub:   "logged in period",
      color: "#7c3aed",
      bar:   null
    },
    {
      label: "Clients",
      value: ALL.clients.length,
      sub:   `${paidCount} paid · ${unpaidCount} unpaid`,
      color: "#6b7280",
      bar:   null
    }
  ];

  defs.forEach((kpi, i) => {
    const el = document.getElementById(`kpi${i}`);
    if (!el) return;
    const barHtml = kpi.bar !== null
      ? `<div style="margin-top:10px;height:3px;border-radius:2px;background:rgba(0,0,0,0.08)">
           <div style="height:3px;border-radius:2px;background:${kpi.color};width:${Math.round((kpi.bar/kpi.max)*100)}%;transition:width .6s ease"></div>
         </div>`
      : "";
    if (kpi.highlight) {
      // "Still to collect" — big, prominent, always the first thing you see
      el.style.border = `2px solid ${kpi.color}33`;
      el.style.background = `${kpi.color}08`;
      el.innerHTML = `
        <div style="padding:14px 16px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${kpi.color};margin-bottom:6px">${kpi.label}</div>
          <div style="font-size:28px;font-weight:900;letter-spacing:-1px;line-height:1;color:${kpi.color}">${kpi.value}</div>
          <div style="font-size:11px;margin-top:6px;color:${kpi.color};opacity:.75">${kpi.sub}</div>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div style="padding:14px 16px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <div style="width:7px;height:7px;border-radius:50%;background:${kpi.color};flex-shrink:0"></div>
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${kpi.color}">${kpi.label}</div>
          </div>
          <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;line-height:1;color:#111">${kpi.value}</div>
          <div class="muted" style="font-size:11px;margin-top:5px">${kpi.sub}</div>
          ${barHtml}
        </div>
      `;
    }
  });
}

// ── Metrics grid ─────────────────────────────────────────
function renderMetrics() {
  const trips    = inPeriod(ALL.trips,    "date");
  const payments = inPeriod(ALL.payments, "date");

  // 1. Avg trip value
  const avgTrip = trips.length
    ? trips.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0) / trips.length
    : 0;

  // 2. Avg debt per unpaid client
  const unpaidClients = ALL.clients.filter(c => (Number(c.amountOwed) || 0) > 0);
  const totalOwed     = unpaidClients.reduce((s, c) => s + (Number(c.amountOwed) || 0), 0);
  const avgDebt       = unpaidClients.length ? totalOwed / unpaidClients.length : 0;

  // 3. Largest single debt
  const bigDebtor = ALL.clients.reduce(
    (best, c) => (Number(c.amountOwed) || 0) > (Number(best.amountOwed) || 0) ? c : best,
    { name: "—", amountOwed: 0 }
  );

  // 4. Fully cleared clients (zero balance)
  const clearedCount = ALL.clients.filter(c => (Number(c.amountOwed) || 0) <= 0).length;

  // 5. Trips logged today
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrips = ALL.trips.filter(t => new Date(t.date).toISOString().slice(0, 10) === todayStr).length;

  // 6. Avg payment size
  const avgPayment = payments.length
    ? payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) / payments.length
    : 0;

  // 7. Direct trip revenue in period
  const directRev = trips
    .filter(t => t.paymentMethod === "direct" || t.payerType === "individual")
    .reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);

  // 8. Partner trip revenue in period
  const partnerRev = trips
    .filter(t => t.paymentMethod === "partner" || t.payerType === "business")
    .reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);

  // 9. Most popular route in period
  const routeMap = {};
  trips.forEach(t => {
    const r = t.origin && t.destination ? `${t.origin} → ${t.destination}` : (t.customRouteName || null);
    if (r) routeMap[r] = (routeMap[r] || 0) + 1;
  });
  const topRouteEntry = Object.entries(routeMap).sort(([, a], [, b]) => b - a)[0];
  const topRoute      = topRouteEntry ? topRouteEntry[0] : "—";
  const topRouteCount = topRouteEntry ? topRouteEntry[1] : 0;

  // 10. Unique routes used in period
  const uniqueRoutes = Object.keys(routeMap).length;

  const metrics = [
    {
      n: "01",
      value: money(avgTrip),
      label: "Avg trip value",
      sub: "per trip in period",
      color: "#2563eb"
    },
    {
      n: "02",
      value: money(avgDebt),
      label: "Avg debt per client",
      sub: `across ${unpaidClients.length} unpaid`,
      color: "#9b1c1c"
    },
    {
      n: "03",
      value: money(bigDebtor.amountOwed),
      label: "Largest single debt",
      sub: bigDebtor.amountOwed > 0 ? bigDebtor.name : "All clear",
      color: Number(bigDebtor.amountOwed) > 0 ? "#9b1c1c" : "#059669"
    },
    {
      n: "04",
      value: clearedCount,
      label: "Clients fully cleared",
      sub: `of ${ALL.clients.length} total`,
      color: "#059669"
    },
    {
      n: "05",
      value: todayTrips,
      label: "Trips today",
      sub: new Date().toLocaleDateString("en-GB", { weekday: "long" }),
      color: "#7c3aed"
    },
    {
      n: "06",
      value: money(avgPayment),
      label: "Avg payment size",
      sub: `${payments.length} payment${payments.length !== 1 ? "s" : ""} in period`,
      color: "#059669"
    },
    {
      n: "07",
      value: money(directRev),
      label: "Direct trip revenue",
      sub: "clients pay personally",
      color: "#2563eb"
    },
    {
      n: "08",
      value: money(partnerRev),
      label: "Partner trip revenue",
      sub: "org covers the cost",
      color: "#d97706"
    },
    {
      n: "09",
      value: topRouteCount > 0 ? topRouteCount : "—",
      label: "Top route trips",
      sub: topRoute.length > 24 ? topRoute.slice(0, 21) + "…" : topRoute,
      color: "#0891b2"
    },
    {
      n: "10",
      value: uniqueRoutes || "—",
      label: "Unique routes",
      sub: "used in this period",
      color: "#7c3aed"
    }
  ];

  metrics.forEach((m, i) => {
    const el = document.getElementById(`m${i}`);
    if (!el) return;
    el.innerHTML = `
      <div style="padding:12px 14px">
        <div style="font-size:10px;font-weight:900;color:#d1d5db;letter-spacing:.5px;margin-bottom:6px">${m.n}</div>
        <div style="font-size:21px;font-weight:900;letter-spacing:-0.5px;line-height:1;color:${m.color}">${m.value}</div>
        <div style="font-size:12px;font-weight:700;color:#111;margin-top:6px">${m.label}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.sub}</div>
      </div>
    `;
  });
}

// ── Revenue vs Collections bar chart ─────────────────────
function renderRevenueChart() {
  const buckets  = getBuckets();
  const trips    = inPeriod(ALL.trips,    "date");
  const payments = inPeriod(ALL.payments, "date");

  const revData = sumBuckets(trips,    "date", "totalAmount", buckets);
  const colData = sumBuckets(payments, "date", "amount",      buckets);
  const labels  = buckets.map(b => b.label);

  const totalRev = revData.reduce((s, v) => s + v, 0);
  const totalCol = colData.reduce((s, v) => s + v, 0);
  const gap      = totalRev - totalCol;

  const subtitleEl = document.getElementById("revenueSubtitle");
  if (subtitleEl) {
    subtitleEl.textContent = totalRev > 0
      ? `${money(totalRev)} billed · ${money(totalCol)} received · ${money(gap)} still to collect`
      : "No data in this period";
  }

  const anyData = revData.some(v => v > 0) || colData.some(v => v > 0);
  setChartEmpty("chartRevenue", "emptyRevenue", !anyData);
  if (!anyData) return;

  makeChart("chartRevenue", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Trips billed",
          data: revData,
          backgroundColor: "rgba(37,99,235,0.75)",
          hoverBackgroundColor: "rgba(37,99,235,0.95)",
          borderRadius: 5,
          borderSkipped: false,
          order: 2
        },
        {
          label: "Money received",
          data: colData,
          backgroundColor: "rgba(5,150,105,0.70)",
          hoverBackgroundColor: "rgba(5,150,105,0.95)",
          borderRadius: 5,
          borderSkipped: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          ...TOOLTIP_BASE,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${money(ctx.raw)}` }
        },
        legend: {
          position: "top",
          align: "end",
          labels: { boxWidth: 10, boxHeight: 10, padding: 14, usePointStyle: true }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          border: { display: false },
          ticks: { callback: v => `£${v}` }
        }
      }
    }
  });
}

// ── Payment methods doughnut ──────────────────────────────
function renderMethodsChart() {
  const payments = inPeriod(ALL.payments, "date");
  const totals   = { "Bank Transfer": 0, "Cash": 0, "Revolut": 0 };
  payments.forEach(p => {
    if (p.method in totals) totals[p.method] += Number(p.amount) || 0;
  });

  const labels = Object.keys(totals).filter(k => totals[k] > 0);
  const data   = labels.map(k => totals[k]);
  const grand  = data.reduce((s, v) => s + v, 0);

  const sub = document.getElementById("methodsSubtitle");
  if (sub) sub.textContent = grand > 0 ? `${money(grand)} total` : "No payments yet";

  setChartEmpty("chartMethods", "emptyMethods", !labels.length);
  if (!labels.length) return;

  makeChart("chartMethods", {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          "rgba(37,99,235,0.85)",
          "rgba(217,119,6,0.85)",
          "rgba(124,58,237,0.85)"
        ],
        borderWidth: 3,
        borderColor: "rgba(255,255,255,0.9)",
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        tooltip: {
          ...TOOLTIP_BASE,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${money(ctx.raw)} (${Math.round(ctx.raw / grand * 100)}%)`
          }
        },
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, boxHeight: 10, padding: 12, usePointStyle: true }
        }
      }
    }
  });
}

// ── Outstanding balances horizontal bar ───────────────────
function renderOutstandingChart() {
  const owing = ALL.clients
    .filter(c => (Number(c.amountOwed) || 0) > 0)
    .sort((a, b) => (Number(b.amountOwed) || 0) - (Number(a.amountOwed) || 0))
    .slice(0, 8);

  setChartEmpty("chartOutstanding", "emptyOutstanding", !owing.length);
  if (!owing.length) return;

  makeChart("chartOutstanding", {
    type: "bar",
    data: {
      labels: owing.map(c => c.name),
      datasets: [{
        label: "Still to collect",
        data: owing.map(c => Number(c.amountOwed) || 0),
        backgroundColor: owing.map((_, i) =>
          i === 0 ? "rgba(155,28,28,0.90)"
          : i <= 2  ? "rgba(155,28,28,0.65)"
          : "rgba(155,28,28,0.40)"
        ),
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP_BASE,
          callbacks: {
            title: ctx => ctx[0].label,
            label: ctx => ` Still to collect: ${money(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 11 }, maxRotation: 30 }
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          border: { display: false },
          ticks: { callback: v => `£${v}` }
        }
      }
    }
  });
}

// ── Trips by route horizontal bar ────────────────────────
function renderRoutesChart() {
  const trips    = inPeriod(ALL.trips, "date");
  const routeMap = {};
  trips.forEach(t => {
    const r = t.origin && t.destination
      ? `${t.origin} → ${t.destination}`
      : (t.customRouteName || "Unknown");
    routeMap[r] = (routeMap[r] || 0) + 1;
  });

  const sorted = Object.entries(routeMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 7);

  setChartEmpty("chartRoutes", "emptyRoutes", !sorted.length);
  if (!sorted.length) return;

  makeChart("chartRoutes", {
    type: "bar",
    data: {
      labels: sorted.map(([r]) => r.length > 22 ? r.slice(0, 19) + "…" : r),
      datasets: [{
        data: sorted.map(([, n]) => n),
        backgroundColor: sorted.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP_BASE,
          callbacks: {
            title: ctx => sorted[ctx[0].dataIndex][0],
            label: ctx => ` ${ctx.raw} trip${ctx.raw !== 1 ? "s" : ""}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 11 }, maxRotation: 35 }
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          border: { display: false },
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

// ── Client types doughnut ─────────────────────────────────
function renderTypesChart() {
  const direct  = ALL.clients.filter(c => (c.clientType || "direct") === "direct").length;
  const partner = ALL.clients.filter(c => c.clientType === "partner").length;

  setChartEmpty("chartTypes", "emptyTypes", !direct && !partner);
  if (!direct && !partner) return;

  makeChart("chartTypes", {
    type: "doughnut",
    data: {
      labels: ["Direct", "Partner"],
      datasets: [{
        data: [direct, partner],
        backgroundColor: ["rgba(37,99,235,0.85)", "rgba(155,28,28,0.85)"],
        borderWidth: 3,
        borderColor: "rgba(255,255,255,0.9)",
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        tooltip: {
          ...TOOLTIP_BASE,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} client${ctx.raw !== 1 ? "s" : ""}`
          }
        },
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, boxHeight: 10, padding: 10, usePointStyle: true }
        }
      }
    }
  });
}

// ── Collection rate ring (SVG) ────────────────────────────
function renderCollectionRing() {
  const trips    = inPeriod(ALL.trips,    "date");
  const payments = inPeriod(ALL.payments, "date");
  const revenue  = trips.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);
  const collected = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const rate = revenue > 0 ? Math.min(collected / revenue, 1) : 0;
  const pct  = Math.round(rate * 100);

  const r     = 50;
  const circ  = 2 * Math.PI * r;
  const dash  = (circ * rate).toFixed(2);
  const gap   = (circ - circ * rate).toFixed(2);

  const color = pct >= 80 ? "#059669" : pct >= 50 ? "#d97706" : "#9b1c1c";
  const label = pct >= 80 ? "Excellent" : pct >= 50 ? "Moderate" : revenue === 0 ? "No data" : "Low";

  document.getElementById("collectionRingWrap").innerHTML = `
    <div style="position:relative;width:148px;height:148px">
      <svg width="148" height="148" viewBox="0 0 148 148" style="transform:rotate(-90deg)">
        <circle cx="74" cy="74" r="${r}" fill="none" stroke="#f0f0f0" stroke-width="13"/>
        <circle cx="74" cy="74" r="${r}" fill="none" stroke="${color}" stroke-width="13"
          stroke-dasharray="${dash} ${gap}" stroke-linecap="round"
          style="transition:stroke-dasharray .8s cubic-bezier(.4,0,.2,1)"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px">
        <div style="font-size:30px;font-weight:900;color:${color};letter-spacing:-1px;line-height:1">${pct}%</div>
        <div style="font-size:10px;font-weight:700;color:${color};letter-spacing:.5px;text-transform:uppercase">${label}</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:8px">
      <div style="font-size:12px;color:#6b7280">${money(collected)} of ${money(revenue)}</div>
    </div>
  `;
}

// ── Unpaid clients list ───────────────────────────────────
function renderUnpaidList() {
  const list  = document.getElementById("unpaidList");
  const empty = document.getElementById("unpaidEmpty");

  const unpaid = ALL.clients
    .filter(c => c.status === "unpaid" && (Number(c.amountOwed) || 0) > 0)
    .sort((a, b) => (Number(b.amountOwed) || 0) - (Number(a.amountOwed) || 0))
    .slice(0, 8);

  list.innerHTML = "";
  if (!unpaid.length) { empty.style.display = "block"; return; }
  empty.style.display = "none";

  const s = ALL.settings;
  unpaid.forEach(c => {
    const num = (c.whatsappNumber || "").replace(/[^\d]/g, "");
    const msg =
      `Hi ${c.name}, you have an outstanding balance of ${money(c.amountOwed)}.\n` +
      (s.bankName
        ? `\nPayment details:\nBank: ${s.bankName}\nAccount: ${s.accountNumber}\nSort code: ${s.sortCode}\nReference: ${c.name}\n`
        : "") +
      `\nThank you 🙏`;
    const waUrl = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : "";

    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;" +
      "padding:9px 0;border-bottom:1px solid var(--border)";
    row.innerHTML = `
      <div style="min-width:0;flex:1">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(c.name)}
        </div>
        <div class="muted" style="font-size:11px;margin-top:1px">
          ${escapeHtml(c.organisation || c.whatsappNumber || "No contact")}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:10px">
        <span class="pill bad" style="font-size:11px;white-space:nowrap">${money(c.amountOwed)}</span>
        ${waUrl
          ? `<a class="btn wa small" href="${waUrl}" target="_blank" rel="noreferrer"
               style="font-size:11px;padding:3px 8px;white-space:nowrap">WA</a>`
          : `<span class="pill" style="font-size:10px">No number</span>`}
      </div>
    `;
    list.appendChild(row);
  });
}

// ── Render all ────────────────────────────────────────────
function renderAll() {
  renderKPIs();
  renderMetrics();
  renderRevenueChart();
  renderMethodsChart();
  renderOutstandingChart();
  renderRoutesChart();
  renderTypesChart();
  renderCollectionRing();
  renderUnpaidList();

  const el = document.getElementById("lastUpdated");
  if (el) {
    el.textContent =
      `Updated ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }
}

// ── Load data ─────────────────────────────────────────────
async function loadData() {
  const [trips, payments, clients, settings] = await Promise.all([
    api("/api/trips"),
    api("/api/payments"),
    api("/api/individual-clients"),
    api("/api/settings").catch(() => ({}))
  ]);
  ALL = { trips, payments, clients, settings };
  renderAll();
}

// ── Period tabs ───────────────────────────────────────────
document.querySelectorAll(".period-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active-period"));
    btn.classList.add("active-period");
    PERIOD = Number(btn.dataset.days);
    renderAll();
  });
});

document.getElementById("refreshBtn").addEventListener("click", () => {
  loadData().catch(e => toast(`Refresh failed: ${e.message}`));
});

// ── Styles ────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  .active-period {
    background: rgba(155,28,28,.10) !important;
    border-color: rgba(155,28,28,.28) !important;
    color: #7f1d1d !important;
  }
  .kpi-card {
    transition: transform .15s ease, box-shadow .15s ease;
    cursor: default;
  }
  .kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.06);
  }
  .chart-empty {
    display: none;
    position: absolute;
    inset: 0;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: #9ca3af;
    font-weight: 500;
    pointer-events: none;
  }
  .metric-card { transition: transform .15s ease; cursor: default; }
  .metric-card:hover { transform: translateY(-2px); }

  @media (max-width: 960px) {
    #kpiStrip, #metricsGrid { grid-template-columns: repeat(3, 1fr) !important; }
    #rowA, #rowB { grid-template-columns: 1fr !important; }
    #rowC        { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 700px) {
    #kpiStrip, #metricsGrid { grid-template-columns: repeat(2, 1fr) !important; }
    #rowA, #rowB, #rowC { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 400px) {
    #kpiStrip, #metricsGrid { grid-template-columns: 1fr 1fr !important; }
  }
`;
document.head.appendChild(style);

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadData().catch(e => toast(`Failed to load dashboard: ${e.message}`));
});
