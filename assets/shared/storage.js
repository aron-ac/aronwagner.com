// Scores are optional enhancements: unavailable or corrupt storage must never
// prevent a game from starting. Only finite, non-negative values are accepted.
export function readStoredNumber(key, fallback = 0) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null || stored.trim() === '') return fallback;
    const value = Number(stored);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredNumber(key, value) {
  if (!Number.isFinite(value) || value < 0) return false;
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
