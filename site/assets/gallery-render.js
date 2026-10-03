import { groupCatalog, effortOf, identityOf } from "./catalog.js";

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Shared by the build and browser so the initial cards survive enhancement.
export function renderGallery(items, { selected = [], returnUrl = "index.html" } = {}) {
  const escape = escapeHtml;
  let imageIndex = 0;
  return groupCatalog(items).map(({ provider, models }) => `<section class="provider-section"><h2 class="provider-title">${escape(provider)}</h2>${models.map(({ model, items }) => `<section class="model-section"><h3 class="model-title">${escape(model)}</h3><div class="gallery">${items.map((s) => {
    const back = `${returnUrl.split("#")[0]}#work-${s.id}`;
    const href = `entry.html?id=${encodeURIComponent(s.id)}&return=${encodeURIComponent(back)}`;
    const image = s.thumbnail || s.cover;
    const priority = imageIndex++ === 0;
    return `<article class="card" id="work-${s.id}"><div class="effort-label"><span class="badge">${escape(effortOf(s))}</span></div><a class="card-cover" href="${escape(href)}" aria-label="查看 ${escape(identityOf(s))}：${escape(s.title)}">${image ? `<img src="submissions/${encodeURIComponent(s.id)}/${escape(image)}" alt="${escape(s.title)}桌面截图" loading="${priority ? "eager" : "lazy"}" ${priority ? 'fetchpriority="high" ' : ""}decoding="async" width="600" height="400">` : '<div class="empty">截图待补充</div>'}</a><div class="card-body"><p>${escape(s.description)}</p><div class="card-bottom"><span>${s.staticCheck.passed ? "静态检查通过" : "静态检查未通过"}</span><label class="check"><input type="checkbox" data-select="${s.id}" ${selected.includes(s.id) ? "checked" : ""}>加入对比<span class="sr-only">：${escape(identityOf(s))} · ${escape(s.title)}</span></label></div></div></article>`;
  }).join("")}</div></section>`).join("")}</section>`).join("");
}
