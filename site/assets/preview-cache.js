// Share in-flight reads and parsed srcdoc across viewports and enlarged previews.
// Failed reads are evicted; an explicit reload clears the cache.
export function createPreviewCache(load, limit = 8) {
  const entries = new Map();
  return {
    clear() { entries.clear(); },
    get(url) {
      if (entries.has(url)) {
        const pending = entries.get(url);
        entries.delete(url);
        entries.set(url, pending);
        return pending;
      }
      const pending = Promise.resolve().then(() => load(url)).catch((error) => {
        if (entries.get(url) === pending) entries.delete(url);
        throw error;
      });
      entries.set(url, pending);
      if (entries.size > limit) entries.delete(entries.keys().next().value);
      return pending;
    },
  };
}
