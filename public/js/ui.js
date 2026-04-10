// Lightweight parallax + background drift (mobile friendly).
// Respects prefers-reduced-motion automatically.

(function () {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const bg = document.querySelector(".fx-bg");
  if (!bg) return;

  const blobs = Array.from(bg.querySelectorAll(".fx-blob"));
  const noise = bg.querySelector(".fx-noise");

  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;

  function setTargetsFromPoint(clientX, clientY) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    targetX = (clientX - cx) / cx; // -1..1
    targetY = (clientY - cy) / cy; // -1..1
  }

  window.addEventListener(
    "mousemove",
    (e) => {
      setTargetsFromPoint(e.clientX, e.clientY);
    },
    { passive: true }
  );

  window.addEventListener(
    "deviceorientation",
    (e) => {
      // iOS may require permission; if denied, values are null and we ignore.
      if (typeof e.gamma !== "number" || typeof e.beta !== "number") return;
      targetX = Math.max(-1, Math.min(1, e.gamma / 25));
      targetY = Math.max(-1, Math.min(1, e.beta / 25));
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      // slight vertical drift with scroll
      const s = Math.min(1, window.scrollY / 900);
      targetY += s * 0.25;
    },
    { passive: true }
  );

  function tick() {
    // critically damped-ish easing
    x += (targetX - x) * 0.06;
    y += (targetY - y) * 0.06;

    blobs.forEach((b, idx) => {
      const depth = (idx + 1) * 10;
      b.style.setProperty("--px", `${x * depth}px`);
      b.style.setProperty("--py", `${y * depth}px`);
    });

    if (noise) {
      noise.style.setProperty("--nx", `${x * 14}px`);
      noise.style.setProperty("--ny", `${y * 10}px`);
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

