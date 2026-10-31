// Self-contained: VitePress serializes MiniSearch options for the default theme.
export function tokenizeSearch(text) {
  const value = String(text).normalize("NFKC").toLowerCase();
  const words = Array.from(new Intl.Segmenter("zh", { granularity: "word" }).segment(value))
    .filter(part => part.isWordLike).map(part => part.segment);
  return [...new Set([...words, ...(value.match(/[a-z0-9][a-z0-9._-]*/g) ?? [])])];
}

export function rankSearchResults(results, limit = 8) {
  const pages = new Map();
  for (const result of results) {
    const page = String(result.id).split("#")[0];
    const score = result.score * (page.includes("/docs/releases/") ? 0.65 : 1);
    if (!pages.has(page) || pages.get(page).score < score) pages.set(page, { ...result, score });
  }
  return [...pages.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function createSearchLoader() {
  const loads = new Map();
  return (key, load) => {
    if (!loads.has(key)) {
      loads.set(key, Promise.resolve().then(load).catch(error => { loads.delete(key); throw error; }));
    }
    return loads.get(key);
  };
}

export function searchPhrases(query) {
  return String(query).normalize("NFKC").toLowerCase().match(/\p{Script=Han}{2,}/gu) ?? [];
}

function displayTerms(query) {
  const phrases = searchPhrases(query);
  return [...new Set([...phrases, ...tokenizeSearch(query).filter(term =>
    !/^\p{Script=Han}$/u.test(term) || !phrases.some(phrase => phrase.includes(term))
  )])];
}

export function searchExcerpt(text, query, length = 130) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  const terms = displayTerms(query);
  const lower = value.toLowerCase();
  const hits = terms.map(term => lower.indexOf(term)).filter(index => index >= 0);
  const start = Math.max(0, (hits.length ? Math.min(...hits) : 0) - 28);
  const end = Math.min(value.length, start + length);
  return `${start ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`;
}

export function highlightSearch(text, query) {
  const value = String(text ?? "");
  const terms = displayTerms(query).sort((a, b) => b.length - a.length);
  if (!terms.length) return [{ text: value, match: false }];
  const escaped = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const expression = new RegExp(`(${escaped.join("|")})`, "giu");
  return value.split(expression).filter(Boolean).map(part => ({
    text: part,
    match: terms.includes(part.toLowerCase())
  }));
}
