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
    for (const [id, { captureButton }] of held) {
      if (captureButton.hasPointerCapture(id)) captureButton.releasePointerCapture(id);
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
        pointers.set(event.pointerId, {
          captureButton: button,
          button,
          action: button.dataset.control,
          pad: button.closest('[data-control-pad]'),
        });
        updateButtons();
      },
      options,
    );
    button.addEventListener(
      'pointermove',
      (event) => {
        const pointer = pointers.get(event.pointerId);
        if (!pointer?.pad) return;
        event.preventDefault();
        // Keep capture on the original button so lifting outside still releases.
        // Sliding only changes actions within the pad where this finger began.
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest('[data-control]');
        const next =
          controls.includes(target) && target.closest('[data-control-pad]') === pointer.pad
            ? target
            : null;
        if (pointer.button === next) return;
        pointer.button = next;
        pointer.action = next?.dataset.control;
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
