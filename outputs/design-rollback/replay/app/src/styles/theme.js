/** Read the same tokens used by CSS when a control needs a concrete color. */
export function themeToken(name, fallback) {
  return typeof document === 'undefined' ? fallback :
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
