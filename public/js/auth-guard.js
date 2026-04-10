(async function () {
  try {
    const res = await fetch("/auth/me");
    const data = await res.json();
    if (!data.user) {
      window.location.replace("/pages/login.html");
      return;
    }
  } catch (_) {
    window.location.replace("/pages/login.html");
    return;
  }

  // Wire up logout button if present
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fetch("/auth/logout", { method: "POST" });
      window.location.replace("/pages/login.html");
    });
  }
})();
