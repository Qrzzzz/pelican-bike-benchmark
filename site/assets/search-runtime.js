// Adapted from personal-docs InlineSearch.vue and inlineSearchRuntime.mjs.
export function searchGeometry(anchor, parentRight, viewport, mobile) {
  const width = mobile ? Math.max(44, viewport.width - 24) : Math.min(560, viewport.width - 56);
  const x = mobile ? viewport.left + 12 - anchor.left : Math.min(0, parentRight - anchor.left - width);
  const y = mobile ? viewport.top + 10 - anchor.top : 0;
  const bottom = anchor.top + y + 44;
  const height = Math.max(0, Math.min(430, viewport.top + viewport.height - bottom - 20));
  return { width, x, y, height };
}
export function isSearchShortcut(event, editing = false) {
  const key = String(event.key || "").toLowerCase();
  return (key === "k" && (event.ctrlKey || event.metaKey)) || (key === "/" && !editing);
}
export function moveSearchSelection(current, count, direction) {
  if (!count) return -1;
  if (direction > 0) return current < 0 || current >= count - 1 ? 0 : current + 1;
  return current <= 0 ? count - 1 : current - 1;
}
export function searchTargetIndex(current, count) {
  return count ? (current >= 0 && current < count ? current : 0) : -1;
}
