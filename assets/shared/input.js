// Movement controls only. Menus, pause, recovery and other shortcuts belong to
// each game. Pointer IDs keep simultaneous fingers independent on touch devices.
export function createGameInput({
  bindings,
  isActive,
  buttons = document.querySelectorAll('[data-control]'),
}) {
  const keys = new Set();
  const pointers = new Map();
  const controls = [...buttons];
  const actions = Object.entries(bindings);
  const codes = new Set(actions.flatMap(([, codes]) => codes));
  const listeners = new AbortController();
  const options = { signal: listeners.signal };

  function isDown(action) {
    if ((bindings[action] || []).some((code) => keys.has(code))) return true;
    for (const pointer of pointers.values()) if (pointer.action === action) return true;
    return false;
  }
  function snapshot(target = {}) {
    for (const [action] of actions) target[action] = isDown(action);
    return target;
  }
  function updateButtons() {
    for (const button of controls) {
      let pressed = false;
      for (const pointer of pointers.values())
        if (pointer.button === button) {
          pressed = true;
          break;
        }
      button.classList.toggle('pressed', pressed);
    }
  }
  function clear() {
    keys.clear();
    const held = [...pointers];
    pointers.clear();
    updateButtons();
    for (const [id, { button }] of held) {
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
  }
  window.addEventListener(
    'keydown',
    (event) => {
      if (!isActive() || !codes.has(event.code)) return;
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest('input, textarea, select, [contenteditable="true"]') ||
          (event.code === 'Space' && target.closest('button, a[href]')))
      )
        return;
      event.preventDefault();
      keys.add(event.code);
    },
    options,
  );
  window.addEventListener('keyup', (event) => keys.delete(event.code), options);
  window.addEventListener('blur', clear, options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) clear();
    },
    options,
  );

  for (const button of controls) {
    button.addEventListener(
      'pointerdown',
      (event) => {
        if (!isActive() || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, { button, action: button.dataset.control });
        updateButtons();
      },
      options,
    );
    const release = (event) => {
      pointers.delete(event.pointerId);
      updateButtons();
    };
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(eventName, release, options);
    }
  }
  return {
    keys,
    isDown,
    snapshot,
    clear,
    dispose() {
      clear();
      listeners.abort();
    },
  };
}
