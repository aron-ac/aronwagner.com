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
