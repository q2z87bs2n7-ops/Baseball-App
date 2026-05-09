// Mobile nav behavioral helpers (Phase 4 of the mobile-nav rework).
// Each helper installs at module-init time and is a no-op on viewports/states
// where it doesn't apply, so callers can install unconditionally.

const HIDE_THRESHOLD_DELTA = 4;   // px of downward scroll before hiding
const SHOW_NEAR_TOP = 40;         // px from top where nav is always shown

let lastScrollY = 0;
let scrollTicking = false;

// Hide the bottom nav while the user scrolls DOWN, restore it the instant they
// scroll UP or reach the top of the page. Throttled with rAF to stay cheap.
export function installHideOnScroll() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  lastScrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const delta = y - lastScrollY;
      if (delta < 0 || y < SHOW_NEAR_TOP) {
        nav.classList.remove('nav-hidden');
      } else if (delta > HIDE_THRESHOLD_DELTA) {
        nav.classList.add('nav-hidden');
      }
      lastScrollY = y;
      scrollTicking = false;
    });
  }, { passive: true });
}
