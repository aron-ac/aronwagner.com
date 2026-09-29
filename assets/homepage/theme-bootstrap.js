// Resolve the theme before styles or page content can paint. The main
// script shares this controller instead of choosing the theme again.
(() => {
  const root = document.documentElement;
  const key = 'site-theme-override';
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  let override = null;
  let storageUnavailable = false;
  function readOverride() {
    if (storageUnavailable) return;
    let stored;
    try {
      stored = localStorage.getItem(key);
    } catch {
      storageUnavailable = true;
      return;
    }
    try {
      override = JSON.parse(stored);
    } catch {
      override = null;
    }
  }
  function schedule() {
    const parts = Object.fromEntries(
      clock.formatToParts(new Date()).map((part) => [part.type, part.value]),
    );
    const hour = Number(parts.hour),
      night = hour >= 19 || hour < 6;
    const date = new Date(
      Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - (hour < 6 ? 1 : 0)),
    )
      .toISOString()
      .slice(0, 10);
    return { night, period: `${date}:${night ? '19' : '06'}` };
  }
  function apply(night) {
    root.classList.toggle('night', night);
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(root)
      .getPropertyValue('--paper')
      .trim();
    return night;
  }
  function refresh(syncStorage = false) {
    if (syncStorage) readOverride();
    const current = schedule();
    if (
      override !== null &&
      (typeof override.night !== 'boolean' || override.period !== current.period)
    ) {
      override = null;
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    return apply(override ? override.night : current.night);
  }
  function toggle() {
    override = { night: !root.classList.contains('night'), period: schedule().period };
    try {
      localStorage.setItem(key, JSON.stringify(override));
    } catch {
      storageUnavailable = true;
    }
    return apply(override.night);
  }
  readOverride();
  const night = refresh();
  window.siteTheme = { key, refresh, toggle };

  const preload = document.createElement('link');
  const scene = night
    ? {
        full: 'assets/office/office-night.webp',
        small: 'assets/office/office-night-small.webp',
      }
    : {
        full: 'assets/office/office-day.webp',
        small: 'assets/office/office-day-small.webp',
      };
  preload.rel = 'preload';
  preload.as = 'image';
  preload.type = 'image/webp';
  preload.href = scene.full;
  preload.imageSrcset = `${scene.small} 768w, ${scene.full} 1536w`;
  preload.imageSizes =
    '(max-width:650px) calc(100vw - 30px), (max-width:1060px) calc(100vw - 60px), 1000px';
  preload.fetchPriority = 'high';
  document.head.appendChild(preload);
})();
