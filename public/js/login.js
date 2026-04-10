(async function () {
  // If already logged in, skip to dashboard
  try {
    const res = await fetch("/auth/me");
    const data = await res.json();
    if (data.user) { window.location.replace("/pages/index.html"); return; }
  } catch (_) {}

  // 3D model viewer
  const mv = document.getElementById("carModel");
  const status = document.getElementById("mvStatus");

  async function initModelViewer() {
    if (!mv) return;
    const hide = () => status?.classList.add("is-hidden");
    const showErr = (msg) => { if (status) { status.textContent = msg; } };

    try {
      await Promise.race([
        customElements.whenDefined("model-viewer"),
        new Promise((_, rej) => setTimeout(() => rej(), 12000))
      ]);
    } catch {
      showErr("3D viewer unavailable."); return;
    }

    mv.src = new URL(mv.getAttribute("src"), window.location.origin).href;
    status && (status.textContent = "Loading model…");
    mv.addEventListener("load", hide, { once: true });
    mv.addEventListener("error", () => showErr("Could not load 3D model."));

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      mv.setAttribute("auto-rotate", "");
      mv.setAttribute("auto-rotate-delay", "1800");
      mv.setAttribute("rotation-per-second", "10deg");
    }
  }

  initModelViewer();

  // Check if Google OAuth is configured
  const googleBtn = document.getElementById("googleBtn");
  try {
    const r = await fetch("/auth/google-enabled");
    const d = await r.json();
    if (!d.enabled) googleBtn.classList.add("disabled");
  } catch (_) {
    // endpoint doesn't exist yet — leave button enabled
  }

  // Show error from URL param (e.g. ?error=google)
  const params = new URLSearchParams(window.location.search);
  const errParam = params.get("error");
  if (errParam) showError(errParam === "google" ? "Google sign-in failed. Please try again." : errParam);

  // Tabs
  const tabLogin = document.getElementById("tabLogin");
  const tabSignup = document.getElementById("tabSignup");
  const formLogin = document.getElementById("formLogin");
  const formSignup = document.getElementById("formSignup");

  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active"); tabSignup.classList.remove("active");
    formLogin.style.display = ""; formSignup.style.display = "none";
    clearError();
  });

  tabSignup.addEventListener("click", () => {
    tabSignup.classList.add("active"); tabLogin.classList.remove("active");
    formSignup.style.display = ""; formLogin.style.display = "none";
    clearError();
  });

  function showError(msg) {
    const el = document.getElementById("loginError");
    el.textContent = msg;
    el.style.display = "block";
  }
  function clearError() {
    const el = document.getElementById("loginError");
    el.style.display = "none";
    el.textContent = "";
  }

  async function submitAuth(url, body, btn) {
    clearError();
    btn.disabled = true;
    btn.textContent = "Please wait…";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "Something went wrong."); return; }
      window.location.replace("/pages/index.html");
    } catch (e) {
      showError("Network error. Please try again.");
    } finally {
      btn.disabled = false;
      btn.textContent = btn.dataset.label;
    }
  }

  formLogin.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = formLogin.querySelector(".login-submit");
    btn.dataset.label = btn.textContent;
    const email = formLogin.email.value.trim();
    const password = formLogin.password.value;
    submitAuth("/auth/login", { email, password }, btn);
  });

  formSignup.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = formSignup.querySelector(".login-submit");
    btn.dataset.label = btn.textContent;
    const name = formSignup.name.value.trim();
    const email = formSignup.email.value.trim();
    const password = formSignup.password.value;
    submitAuth("/auth/signup", { name, email, password }, btn);
  });
})();
