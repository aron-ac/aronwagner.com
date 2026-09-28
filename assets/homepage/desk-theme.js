// This alternate scene retains its own legacy preference and night deep link.
// Resolve both before the external stylesheet and scene can paint.
(() => {
  let night = location.hash === '#nightmode';
  try {
    night = night || localStorage.getItem('mark-site-theme') === 'night';
  } catch {}
  document.documentElement.classList.toggle('nightmode', night);
})();
