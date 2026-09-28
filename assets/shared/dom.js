export function requireElements(ids, root = document) {
  return Object.fromEntries(
    ids.map((id) => {
      const element = root.querySelector(`#${id}`);
      if (!element) throw new Error(`Missing required game element: #${id}`);
      return [id, element];
    }),
  );
}

// HUDs update frequently. Preserve their text nodes when values haven't changed.
export function setText(element, value) {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

export function setAttribute(element, name, value) {
  const text = String(value);
  if (element.getAttribute(name) !== text) element.setAttribute(name, text);
}

// Global menu shortcuts must not consume a focused control's native activation.
export function isInteractiveTarget(target) {
  return (
    target instanceof Element &&
    (target.isContentEditable ||
      Boolean(
        target.closest(
          'a[href], button, input, textarea, select, summary, [role="button"], [role="link"]',
        ),
      ))
  );
}
