// Each arcade page owns one render loop. Browser lifecycle events pause play;
// returning from the back/forward cache resumes drawing until the player resumes.
export function createGameLoop({ viewport, frame, pause, clearInput, resize, dispose: release }) {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const observer = new ResizeObserver(resize);
  let frameId = 0;
  let lastTime = 0;
  let running = false;
  let disposed = false;

  function tick(now) {
    frameId = 0;
    if (!running) return;
    const dt = Math.max(0, Math.min((now - lastTime) / 1000, 0.05));
    lastTime = now;
    frame(dt, now);
    if (running) frameId = requestAnimationFrame(tick);
  }
  function start() {
    if (running || disposed) return;
    running = true;
    lastTime = performance.now();
    frameId = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
  function pausePlay() {
    clearInput();
    pause();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    listeners.abort();
    observer.disconnect();
    release();
  }

  window.addEventListener('blur', pausePlay, options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) pausePlay();
    },
    options,
  );
  window.addEventListener(
    'pagehide',
    (event) => {
      pausePlay();
      stop();
      if (!event.persisted) dispose();
    },
    options,
  );
  window.addEventListener(
    'pageshow',
    () => {
      resize();
      start();
    },
    options,
  );
  observer.observe(viewport);
  resize();
  return { start, stop, dispose };
}
