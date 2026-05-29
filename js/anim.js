// Entrance reveals, scrollspy nav highlighting, a scroll-progress bar, and
// number count-ups. All browser-only effects degrade gracefully (and no-op in
// node, so the headless tests keep working).

const reduce =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initAnimations() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add("anim-ready");
  setupReveal();
  setupScrollspy();
  setupProgress();
}

function setupReveal() {
  const els = document.querySelectorAll("[data-reveal]");
  if (reduce || typeof IntersectionObserver === "undefined") {
    els.forEach((el) => el.classList.add("in-view"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach((el) => io.observe(el));
}

function setupScrollspy() {
  const links = [...document.querySelectorAll('.nav a[href^="#"]')];
  if (!links.length || typeof IntersectionObserver === "undefined") return;
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const sections = [...byId.keys()]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          links.forEach((a) => a.classList.remove("active"));
          byId.get(e.target.id)?.classList.add("active");
        }
      }
    },
    { threshold: 0.5 }
  );
  sections.forEach((s) => io.observe(s));
}

function setupProgress() {
  const bar = document.getElementById("scroll-progress");
  if (!bar) return;
  const update = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = max > 0 ? `${(h.scrollTop / max) * 100}%` : "0%";
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

// Animate a number from `from` to `to`. Synchronous (final value) under reduced
// motion or in node (no requestAnimationFrame).
export function countUp(el, to, { from = 0, decimals = 1, duration = 650, suffix = "" } = {}) {
  if (!el) return;
  if (to == null || Number.isNaN(to)) {
    el.textContent = "—";
    return;
  }
  if (reduce || typeof requestAnimationFrame === "undefined") {
    el.textContent = to.toFixed(decimals) + suffix;
    return;
  }
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function frame(now) {
    const p = Math.min(1, (now - start) / duration);
    el.textContent = (from + (to - from) * ease(p)).toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
