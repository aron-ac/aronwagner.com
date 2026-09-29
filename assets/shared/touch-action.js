// Secondary touch pointers do not reliably produce click events. Activate these
// game actions on touch/pen down, while retaining native keyboard and mouse clicks.
export function bindTouchAction(button, action) {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const pointers = new Set();
  let suppressPointerClick = false;

  button.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
        suppressPointerClick = false;
        return;
      }
      if (button.disabled || event.button !== 0) return;
      event.preventDefault();
      suppressPointerClick = true;
      pointers.add(event.pointerId);
      // An action can reveal a menu beneath this finger. Keep its release on
      // the original button so it cannot activate a newly exposed menu item.
      button.setPointerCapture(event.pointerId);
      action(event);
    },
    options,
  );
  button.addEventListener(
    'click',
    (event) => {
      if (
        event.detail !== 0 &&
        (event.pointerType === 'touch' || event.pointerType === 'pen' || suppressPointerClick)
      ) {
        event.preventDefault();
        return;
      }
      // Keyboard and assistive technology can dispatch a zero-detail click
      // directly, including touch screen readers, without any pointerdown.
      if (!button.disabled) action(event);
    },
    options,
  );
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, (event) => pointers.delete(event.pointerId), options);
  }

  return function dispose() {
    listeners.abort();
    for (const id of pointers) {
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
    pointers.clear();
  };
}
