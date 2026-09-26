// Only return to this deployment's gallery; never accept an arbitrary redirect.
export function galleryReturn(value, currentUrl) {
  const fallback = new URL("index.html#gallery", currentUrl);
  if (!value) return fallback;
  try {
    const target = new URL(value, currentUrl);
    if (target.origin !== fallback.origin || target.username || target.password ||
        target.pathname !== fallback.pathname) return fallback;
    const clean = new URL(fallback);
    for (const key of ["q", "provider", "model", "effort", "kind"]) {
      if (target.searchParams.has(key)) clean.searchParams.set(key, target.searchParams.get(key));
    }
    if (/^#work-[a-z0-9][a-z0-9-]{0,79}$/.test(target.hash)) clean.hash = target.hash;
    return clean;
  } catch { return fallback; }
}

export function galleryPosition(value, url) {
  if (!value || value.url !== url || !Number.isFinite(value.y) || value.y < 0 ||
      !/^work-[a-z0-9][a-z0-9-]{0,79}$/.test(value.anchor)) return null;
  return value;
}
