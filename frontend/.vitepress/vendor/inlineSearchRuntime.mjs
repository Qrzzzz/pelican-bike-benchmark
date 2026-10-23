export function isSearchShortcut(event, isEditingContent = false) {
  const key = String(event?.key ?? "").toLowerCase();
  if (key === "k" && (event?.ctrlKey || event?.metaKey)) return true;
  return key === "/" && !isEditingContent;
}

export function moveSearchSelection(currentIndex, resultCount, direction) {
  if (resultCount <= 0) return -1;
  if (direction > 0) {
    return currentIndex < 0 || currentIndex >= resultCount - 1 ? 0 : currentIndex + 1;
  }
  return currentIndex <= 0 ? resultCount - 1 : currentIndex - 1;
}

export function resolveSearchTargetIndex(currentIndex, resultCount) {
  if (resultCount <= 0) return -1;
  return currentIndex >= 0 && currentIndex < resultCount ? currentIndex : 0;
}
