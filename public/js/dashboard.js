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

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function load() {
  try {
    const [individuals, trips, payments, settings] = await Promise.all([
      api("/api/individual-clients"),
      api("/api/trips"),
      api("/api/payments"),
      api("/api/settings")
    ]);

    // KPIs
    const unpaid = individuals.filter(c => c.status === "unpaid");
    const paid = individuals.filter(c => c.status === "paid");
    const unpaidTotal = unpaid.reduce((s, c) => s + (Number(c.amountOwed) || 0), 0);

    document.getElementById("kpiUnpaidAmount").textContent = money(unpaidTotal);
    document.getElementById("kpiUnpaidCount").textContent = `${unpaid.length} unpaid`;
    document.getElementById("kpiTotalCount").textContent = `${individuals.length} total`;
    document.getElementById("kpiPaidCount").textContent = paid.length;

    // Unpaid list
    const unpaidList = document.getElementById("unpaidList");
    unpaidList.innerHTML = "";
    if (!unpaid.length) {
      document.getElementById("unpaidEmpty").style.display = "block";
    } else {
      document.getElementById("unpaidEmpty").style.display = "none";
      unpaid
        .sort((a, b) => (Number(b.amountOwed) || 0) - (Number(a.amountOwed) || 0))
        .slice(0, 10)
        .forEach(p => {
          const waNum = (p.whatsappNumber || "").replace(/[^\d]/g, "");
          const msg =
            `Hi ${p.name}, you have an outstanding balance of ${money(p.amountOwed)}.\n` +
            (settings.bankName ? `Please transfer to:\nBank: ${settings.bankName}\nAccount: ${settings.accountNumber}\nSort Code: ${settings.sortCode}\nReference: ${p.name}\n` : "") +
            `Thank you 🙏`;
          const waUrl = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}` : "";

          const el = document.createElement("div");
          el.className = "list-item";
          el.innerHTML = `
            <div>
              <strong>${escapeHtml(p.name)}</strong>
              <div class="muted">${escapeHtml(p.whatsappNumber || "No WhatsApp number")}</div>
            </div>
            <div class="right">
              <span class="pill bad">${money(p.amountOwed)}</span>
              ${waUrl
                ? `<a class="btn wa small" target="_blank" rel="noreferrer" href="${waUrl}">WhatsApp</a>`
                : `<span class="pill" style="font-size:11px">No number</span>`
              }
            </div>
          `;
          unpaidList.appendChild(el);
        });
    }

    // All clients overview
    const allClientsList = document.getElementById("allClientsList");
    allClientsList.innerHTML = "";
    if (!individuals.length) {
      document.getElementById("allClientsEmpty").style.display = "block";
    } else {
      document.getElementById("allClientsEmpty").style.display = "none";
      individuals
        .slice()
        .sort((a, b) => (Number(b.amountOwed) || 0) - (Number(a.amountOwed) || 0))
        .slice(0, 8)
        .forEach(c => {
          const isPaid = c.status === "paid";
          const el = document.createElement("div");
          el.className = "list-item";
          el.innerHTML = `
            <div>
              <strong>${escapeHtml(c.name)}</strong>
              <div class="muted">${escapeHtml(c.whatsappNumber || "No number")}</div>
            </div>
            <div class="right">
              <span class="pill ${isPaid ? "good" : c.amountOwed > 0 ? "bad" : ""}">${money(c.amountOwed)}</span>
              <span class="pill" style="font-size:11px">${isPaid ? "Paid" : "Unpaid"}</span>
            </div>
          `;
          allClientsList.appendChild(el);
        });
    }

    // Recent trips
    const tripsTbody = document.getElementById("recentTripsTbody");
    tripsTbody.innerHTML = "";
    const recentTrips = (trips || []).slice(0, 8);
    if (!recentTrips.length) {
      document.getElementById("tripsEmpty").style.display = "block";
    } else {
      document.getElementById("tripsEmpty").style.display = "none";
      recentTrips.forEach(t => {
        const routeName = t.route ? t.route.name : "";
        const routeVariant = t.variant ? `${routeName} (${t.variant})` : routeName;
        const people = Array.isArray(t.workers) ? t.workers.map(w => w.name).join(", ") : "";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${fmtDate(t.date)}</td>
          <td>${escapeHtml(routeVariant)}</td>
          <td>${escapeHtml(people)}</td>
          <td>${money(t.totalAmount)}</td>
        `;
        tripsTbody.appendChild(tr);
      });
    }

    // Recent payments
    const paymentsTbody = document.getElementById("recentPaymentsTbody");
    paymentsTbody.innerHTML = "";
    const recentPayments = (payments || []).slice(0, 8);
    if (!recentPayments.length) {
      document.getElementById("paymentsEmpty").style.display = "block";
    } else {
      document.getElementById("paymentsEmpty").style.display = "none";
      recentPayments.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(p.payerName)}</td>
          <td>${fmtDate(p.date)}</td>
          <td>${escapeHtml(p.method)}</td>
          <td>${money(p.amount)}</td>
        `;
        paymentsTbody.appendChild(tr);
      });
    }

  } catch (e) {
    toast(`Dashboard failed to load: ${e.message}`);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", load);
} else {
  load();
}
