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

async function loadWorkers() {
  const workers = await api("/api/workers");
  const list = document.getElementById("workerList");
  const empty = document.getElementById("workersEmpty");
  document.getElementById("workerCount").textContent = `${workers.length} total`;
  list.innerHTML = "";

  if (!workers.length) { empty.style.display = "block"; return; }
  empty.style.display = "none";

  workers.forEach(w => {
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div><strong>${escapeHtml(w.name)}</strong></div>
      <button class="btn small" data-del="${w._id}" data-name="${escapeHtml(w.name)}" type="button">Delete</button>
    `;
    list.appendChild(el);
  });

  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Delete "${btn.dataset.name}"?`)) return;
      try {
        await api(`/api/workers/${btn.dataset.del}`, { method: "DELETE" });
        toast("Worker deleted.");
        loadWorkers();
      } catch(e) { toast(`Error: ${e.message}`); }
    });
  });
}

document.getElementById("workerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = document.getElementById("workerName").value.trim();
  const btn = e.target.querySelector(".btn.primary");
  btn.disabled = true;
  try {
    await api("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    document.getElementById("workerName").value = "";
    toast(`"${name}" added.`);
    loadWorkers();
  } catch(err) { toast(`Error: ${err.message}`); }
  finally { btn.disabled = false; }
});

document.getElementById("refreshBtn").addEventListener("click", loadWorkers);

document.addEventListener("DOMContentLoaded", () => loadWorkers().catch(e => toast(e.message)));
