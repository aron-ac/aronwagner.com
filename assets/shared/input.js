// Movement controls only. Menus, pause, recovery and other shortcuts belong to
// each game. Pointer IDs keep simultaneous fingers independent on touch devices.
const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

export function createGameInput({
  bindings,
  isActive,
  buttons = document.querySelectorAll('[data-control]'),
  exclusiveDirections = false,
}) {
  const keys = new Set();
  const keyOrder = new Map();
  const pointers = new Map();
  let pressOrder = 0;
  const controls = [...buttons];
  const directionalPads = [
    ...new Set(controls.map((button) => button.closest('[data-dpad]'))),
  ].filter(Boolean);
  const actions = Object.entries(bindings);
  const codes = new Set(actions.flatMap(([, codes]) => codes));
  const listeners = new AbortController();
  const options = { signal: listeners.signal };

  function activeDirection() {
    let selected = null;
    let latest = -1;
    for (const code of keys) {
      const action = actions.find(
        ([action, codes]) => DIRECTIONS.has(action) && codes.includes(code),
      );
      const order = keyOrder.get(code) ?? 0;
      if (action && order >= latest) {
        selected = action[0];
        latest = order;
      }
    }
    for (const pointer of pointers.values()) {
      const action = pointer.actions.find((action) => DIRECTIONS.has(action));
      if (action && pointer.order > latest) {
        selected = action;
        latest = pointer.order;
      }
    }
    return selected;
  }
  function isDown(action) {
    if (exclusiveDirections && DIRECTIONS.has(action)) return activeDirection() === action;
    if ((bindings[action] || []).some((code) => keys.has(code))) return true;
    for (const pointer of pointers.values()) if (pointer.actions.includes(action)) return true;
    return false;
  }
  function snapshot(target = {}) {
    for (const [action] of actions) target[action] = isDown(action);
    return target;
  }
  function updateButtons() {
    const direction = exclusiveDirections ? activeDirection() : null;
    for (const button of controls) {
      let pressed = false;
      if (exclusiveDirections && DIRECTIONS.has(button.dataset.control)) {
        pressed = direction === button.dataset.control;
      } else {
        for (const pointer of pointers.values())
          if (pointer.buttons.includes(button)) {
            pressed = true;
            break;
          }
      }
      button.classList.toggle('pressed', pressed);
    }
  }
  function clear() {
    keys.clear();
    keyOrder.clear();
    const held = [...pointers];
    pointers.clear();
    updateButtons();
    for (const [id, { captureElement }] of held) {
      if (captureElement.hasPointerCapture(id)) captureElement.releasePointerCapture(id);
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
      // Repeated keydown events must not take priority from a newer direction.
      if (!keys.has(event.code)) {
        keys.add(event.code);
        keyOrder.set(event.code, ++pressOrder);
        updateButtons();
      }
    },
    options,
  );
  window.addEventListener(
    'keyup',
    (event) => {
      keys.delete(event.code);
      keyOrder.delete(event.code);
      updateButtons();
    },
    options,
  );
  window.addEventListener('blur', clear, options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) clear();
    },
    options,
  );

  function selectButtons(pointer, buttons) {
    if (pointer.buttons.length !== buttons.length || pointer.buttons[0] !== buttons[0]) {
      pointer.buttons = buttons;
      pointer.actions = buttons.map((button) => button.dataset.control);
      pointer.order = ++pressOrder;
    }
  }

  function updateDirectionalPad(pointer, event) {
    // Only the visible arrows drive. Empty corners, the center and the gaps
    // remain neutral, while capture lets a thumb slide onto another arrow.
    const button = controls.find((button) => {
      if (button.closest('[data-dpad]') !== pointer.pad) return false;
      const bounds = button.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        event.clientX >= bounds.left &&
        event.clientX < bounds.left + bounds.width &&
        event.clientY >= bounds.top &&
        event.clientY < bounds.top + bounds.height
      );
    });
    selectButtons(pointer, button ? [button] : []);
  }

  // Starting in a gap is neutral, but still allows sliding onto an arrow.
  // Pointer capture stays on the surface where that finger first touched down.
  for (const surface of [...controls, ...directionalPads]) {
    surface.addEventListener(
      'pointerdown',
      (event) => {
        if (
          !isActive() ||
          pointers.has(event.pointerId) ||
          (event.pointerType === 'mouse' && event.button !== 0)
        )
          return;
        event.preventDefault();
        surface.setPointerCapture(event.pointerId);
        const pointer = {
          captureElement: surface,
          buttons: [],
          actions: [],
          order: 0,
          pad: surface.closest('[data-control-pad]'),
        };
        if (directionalPads.includes(pointer.pad)) updateDirectionalPad(pointer, event);
        else selectButtons(pointer, controls.includes(surface) ? [surface] : []);
        pointers.set(event.pointerId, pointer);
        updateButtons();
      },
      options,
    );
    surface.addEventListener(
      'pointermove',
      (event) => {
        const pointer = pointers.get(event.pointerId);
        if (!pointer?.pad || pointer.captureElement !== surface) return;
        event.preventDefault();
        if (directionalPads.includes(pointer.pad)) {
          updateDirectionalPad(pointer, event);
          updateButtons();
          return;
        }
        // Keep capture on the original button so lifting outside still releases.
        // Sliding only changes actions within the pad where this finger began.
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest('[data-control]');
        const next =
          controls.includes(target) && target.closest('[data-control-pad]') === pointer.pad
            ? target
            : null;
        selectButtons(pointer, next ? [next] : []);
        updateButtons();
      },
      options,
    );
    const release = (event) => {
      if (pointers.get(event.pointerId)?.captureElement !== surface) return;
      pointers.delete(event.pointerId);
      updateButtons();
    };
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      surface.addEventListener(eventName, release, options);
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
