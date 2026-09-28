// A classic deferred script can report a failed ES-module dependency as well as
// initialization errors. Keep this small so even a broken game has useful UI.
(() => {
  const entry = document.currentScript.dataset.entry;
  const status = document.getElementById('load-state');
  const loadingText = status.textContent;
  if (location.protocol === 'file:') {
    status.textContent = 'Open this game through a local server: npm run dev, then localhost:8000.';
    return;
  }
  import(new URL(entry, document.baseURI).href).catch((error) => {
    console.error('Unable to initialize game:', error);
    if (status.textContent === loadingText) {
      status.textContent = 'Could not load the game. Please refresh and try again.';
    }
    status.classList.remove('hidden');
  });
})();
