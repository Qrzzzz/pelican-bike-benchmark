import { cascade, groupCatalog, effortOf, identityOf } from "./catalog.js";
import { runThemeTransition } from "./theme-transition.js";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const weights = {
  runnable: 0.2,
  visual: 0.3,
  animation: 0.2,
  accessibility: 0.2,
  quality: 0.1,
};
const dimensions = {
  runnable: "可运行性",
  visual: "画面识别与构图",
  animation: "动画与交互",
  accessibility: "响应式与无障碍",
  quality: "代码质量与性能",
};
const params = new URLSearchParams(location.search);
let submissions = [],
  prompt,
  selected = [],
  viewport = "desktop",
  mode = "image",
  toastTimer;
const safeId = (id) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(id);
const asset = (item, file) =>
  `submissions/${encodeURIComponent(item.id)}/${file}`;
const detailUrl = (item) => `entry.html?id=${encodeURIComponent(item.id)}`;
const isDemo = (item) => item.kind === "demo";
const totalScore = (item) =>
  item.review &&
  Object.keys(weights).every((k) => Number.isFinite(item.review.scores?.[k]))
    ? (
        Object.entries(weights).reduce(
          (v, [k, w]) => v + item.review.scores[k] * w,
          0,
        ) * 10
      ).toFixed(1)
    : "未评分";
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("读取失败");
  return response.json();
}
function notify(message) {
  if ($("#prompt-dialog").open) {
    $("#dialog-status").textContent = message;
    return;
  }
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 3500);
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify("已复制到剪贴板");
  } catch {
    notify("浏览器未允许复制，请在文本区域中手动选择并复制");
  }
}
function saveSelection() {
  try {
    sessionStorage.setItem("pelican-selection", JSON.stringify(selected));
  } catch {}
}
function setThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  $("#theme-toggle").classList.toggle("is-dark", dark);
  $("#theme-toggle").setAttribute("aria-checked", String(dark));
  $("#theme-toggle").setAttribute(
    "aria-label",
    document.documentElement.dataset.theme === "dark"
      ? "切换为浅色主题"
      : "切换为深色主题",
  );
  $("#theme-toggle").title = $("#theme-toggle").getAttribute("aria-label");
}
setThemeButton();
document.addEventListener("themechange", setThemeButton);
let switchingTheme = false;
$("#theme-toggle").addEventListener("click", async () => {
  if (switchingTheme) return;
  switchingTheme = true;
  $("#theme-toggle").setAttribute("aria-busy", "true");
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try {
    await runThemeTransition({ documentObject: document, windowObject: window,
      origin: $("#theme-toggle"), update: () => window.setPelicanTheme(next) });
  } finally {
    switchingTheme = false;
    $("#theme-toggle").removeAttribute("aria-busy");
  }
});
$("#close-prompt").addEventListener("click", () => $("#prompt-dialog").close());
$("#prompt-dialog").addEventListener("click", (event) => {
  if (event.target !== event.currentTarget) return;
  const rect = event.currentTarget.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
    event.currentTarget.close();
});
$$("[data-prompt]").forEach((button) =>
  button.addEventListener("click", () => {
    if (!prompt) return notify("提示词尚未载入，请刷新后重试");
    $("#dialog-status").textContent = "";
    $("#prompt-dialog").showModal();
    $(".dialog-body").scrollTop = 0;
  }),
);
$$("[data-copy-prompt]").forEach((button) =>
  button.addEventListener("click", () =>
    prompt ? copy(prompt.text) : notify("提示词尚未载入，请刷新后重试"),
  ),
);
function updateTray() {
  const tray = $("#tray");
  if (!tray) return;
  tray.hidden = !selected.length;
  $("#selection-count").textContent = `已选 ${selected.length} / 4`;
  $("#start-compare").disabled = selected.length < 2;
  let list = $("#selected-items");
  if (!list) {
    list = document.createElement("div");
    list.id = "selected-items";
    list.className = "selected-items";
    tray.append(list);
  }
  list.hidden = $("#selection-toggle").getAttribute("aria-expanded") !== "true";
  if (!selected.length) $("#selection-toggle").setAttribute("aria-expanded", "false");
  list.innerHTML = selected.map((id) => {
    const item = submissions.find((s) => s.id === id);
    return `<button class="selection-chip" data-remove="${id}" aria-label="移除 ${escape(item.title)}">${escape(item.title)} <span aria-hidden="true">×</span></button>`;
  }).join("");
  $$('[data-remove]', list).forEach((button) => button.addEventListener("click", () => {
    const position = selected.indexOf(button.dataset.remove);
    selected = selected.filter((id) => id !== button.dataset.remove);
    const input = $(`[data-select="${button.dataset.remove}"]`);
    if (input) input.checked = false;
    saveSelection();
    updateTray();
    ($$("[data-remove]", list)[Math.min(position, selected.length - 1)] || input || $("#search")).focus();
  }));
}
function home() {
  let filter = params.get("kind") === "benchmark" ? "benchmark" : "all";
  $(".filters .tabs").hidden = new Set(submissions.map((s) => s.kind)).size < 2;
  $("#search").value = params.get("q") || "";
  $("#filter-toggle").addEventListener("click", () => {
    const expanded = $("#filter-toggle").getAttribute("aria-expanded") !== "true";
    $("#filter-toggle").setAttribute("aria-expanded", String(expanded));
    $("#filter-toggle").textContent = expanded ? "收起筛选" : "筛选条件";
  });
  function syncFilters(requested) {
    const state = cascade(submissions, requested);
    for (const [key, values, label, title] of [["provider", state.providers, "厂家", "所有厂家"], ["model", state.models, "模型", "所有模型"], ["effort", state.efforts, "推理强度", "全部"]]) {
      const select = $(`#${key}-filter`);
      select.innerHTML = `<option value="">${label} · ${title}</option>` + values.map((value) => `<option value="${escape(value)}">${label} · ${escape(value)}</option>`).join("");
      select.value = state[key];
    }
  }
  const currentFilters = () => Object.fromEntries(["provider", "model", "effort"].map((key) => [key, $(`#${key}-filter`).value]));
  syncFilters(Object.fromEntries(params));
  $$("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
  $("#total-count").textContent = String(submissions.length).padStart(2, "0");
  const formal = submissions.filter((s) => !isDemo(s)).length;
  $("#demo-note").textContent = formal
    ? `当前收录 ${formal} 个正式测试。所有作品保留原始输出，未评分项不参与排名。`
    : "目前尚无正式参测结果。";
  function render() {
    const query = $("#search").value.trim().toLocaleLowerCase();
    const { provider, model, effort } = currentFilters();
    const conditions = [query && `搜索：${$("#search").value.trim()}`, filter === "benchmark" && "正式测试", provider, model, effort].filter(Boolean);
    $("#filter-summary").hidden = !conditions.length;
    $("#active-filters").textContent = conditions.join(" / ");
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ q: $("#search").value.trim(), provider, model, effort, kind: filter === "all" ? "" : filter })) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    history.replaceState(null, "", url);
    const shown = submissions.filter(
      (s) =>
        (filter === "all" || s.kind === filter) &&
        (!provider || s.modelProvider === provider) &&
        (!model || s.model === model) &&
        (!effort || effortOf(s) === effort) &&
        `${s.title} ${s.modelProvider || ""} ${s.model} ${s.version} ${s.description} ${s.parameters?.reasoningEffort || ""}`
          .toLocaleLowerCase()
          .includes(query),
    );
    $("#result-count").textContent =
      `${shown.length} 个作品 · ${formal} 个正式测试`;
    $("#cards").innerHTML = shown.length
      ? groupCatalog(shown).map(({ provider, models }) => `<section class="provider-section"><h2 class="provider-title">${escape(provider)}</h2>${models.map(({ model, items }) => `<section class="model-section"><h3 class="model-title">${escape(model)}</h3><div class="gallery">${items.map((s) => `<article class="card"><div class="effort-label"><span class="badge">${escape(effortOf(s))}</span></div><a class="card-cover" href="${detailUrl(s)}" aria-label="查看 ${escape(identityOf(s))}：${escape(s.title)}">${s.cover ? `<img src="${asset(s, s.cover)}" alt="${escape(s.title)}桌面截图" loading="lazy" width="600" height="400">` : '<div class="empty">截图待补充</div>'}</a><div class="card-body"><p>${escape(s.description)}</p><div class="card-bottom"><span>${s.staticCheck.passed ? "静态检查通过" : "静态检查未通过"}</span><label class="check"><input type="checkbox" data-select="${s.id}" ${selected.includes(s.id) ? "checked" : ""}>加入对比<span class="sr-only">：${escape(identityOf(s))} · ${escape(s.title)}</span></label></div></div></article>`).join("")}</div></section>`).join("")}</section>`).join("")
      : '<div class="empty"><h3>这里暂时没有作品。</h3><p>试试其他关键词或筛选条件。</p><button class="button" id="reset-filters">重置筛选</button></div>';
    $("#reset-filters")?.addEventListener("click", resetFilters);
    $$("[data-select]").forEach((input) =>
      input.addEventListener("change", () => {
        const id = input.dataset.select;
        if (input.checked) {
          if (selected.length >= 4) {
            input.checked = false;
            notify("最多可选择 4 个作品");
            return;
          }
          selected.push(id);
        } else selected = selected.filter((s) => s !== id);
        saveSelection();
        updateTray();
      }),
    );
  }
  function resetFilters() {
    filter = "all";
    $("#search").value = "";
    syncFilters({});
    $$("[data-filter]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.filter === filter)),
    );
    render();
    $("#search").focus();
  }
  $("#clear-filters").addEventListener("click", resetFilters);
  $$("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.filter;
      $$("[data-filter]").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === b)),
      );
      render();
    }),
  );
  $("#search").addEventListener("input", render);
  for (const key of ["provider", "model", "effort"]) {
    $(`#${key}-filter`).addEventListener("change", () => {
      syncFilters(currentFilters());
      render();
    });
  }
  $("#selection-toggle").addEventListener("click", () => {
    const button = $("#selection-toggle");
    button.setAttribute("aria-expanded", String(button.getAttribute("aria-expanded") !== "true"));
    updateTray();
  });
  $("#clear-selection").addEventListener("click", () => {
    selected = [];
    saveSelection();
    render();
    updateTray();
    $("#search").focus();
  });
  $("#start-compare").addEventListener("click", () => {
    location.href = `compare.html?ids=${selected.join(",")}`;
  });
  render();
  updateTray();
}
function specs(item) {
  const rows = [
    ["类型", isDemo(item) ? "功能演示 · 非模型测试" : "正式测试"],
    ["厂家", isDemo(item) ? "不适用" : item.modelProvider],
    ["模型", isDemo(item) ? "不适用" : item.model],
    ["版本", isDemo(item) ? "不适用" : item.version],
    ["生成日期", item.generatedAt || "未记录"],
    ["推理强度", effortOf(item)],
    ["提示词版本", item.promptVersion],
    ["静态检查", item.staticCheck.passed ? "通过" : "未通过"],
    ["评分", isDemo(item) ? "不参与评分" : totalScore(item)],
  ];
  return `<dl class="spec-list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${escape(v)}</dd></div>`).join("")}</dl>`;
}
const observers = new Map();
const previewRequests = new Set();
function clearPreviews() {
  previewRequests.forEach((controller) => controller.abort());
  previewRequests.clear();
  observers.forEach((observer) => observer.disconnect());
  observers.clear();
}
function mountPreview(container, item, { previewViewport = viewport, previewMode = mode } = {}) {
  container.classList.toggle("mobile", previewViewport === "mobile");
  container.replaceChildren();
  if (previewMode === "image") {
    const file = isDemo(item) ? item.cover : item.screenshots?.[previewViewport];
    if (file) {
      const img = document.createElement("img");
      img.src = asset(item, file);
      img.alt = `${item.title} · ${isDemo(item) ? "演示插画，非实测截图" : previewViewport === "mobile" ? "手机实测截图" : "桌面实测截图"}`;
      img.addEventListener("error", () => {
        if (!img.isConnected) return;
        container.innerHTML = '<div class="preview-placeholder">截图暂时无法载入，可切换到运行预览。</div>';
      });
      container.append(img);
    } else
      container.innerHTML =
        '<div class="preview-placeholder">该视口的实测截图尚未提供。<br>可切换到运行预览。</div>';
    return;
  }
  if (!item.staticCheck.passed) {
    container.innerHTML =
      '<div class="preview-placeholder">静态检查未通过，运行预览已停用。<br>请在详情页查看检查报告和原始输出。</div>';
    return;
  }
  const frame = document.createElement("iframe");
  frame.title = `${item.title} · ${previewViewport === "mobile" ? "手机" : "桌面"}运行预览`;
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.setAttribute(
    "allow",
    "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'",
  );
  container.append(frame);
  // Reuse the validated wrapper's srcdoc in a single sandbox, avoiding nested scaled frames.
  const controller = new AbortController();
  previewRequests.add(controller);
  fetch(asset(item, "preview.html"), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
    .then((response) => {
      if (!response.ok) throw new Error();
      return response.text();
    })
    .then((html) => {
      const source = new DOMParser()
        .parseFromString(html, "text/html")
        .querySelector("iframe")
        ?.getAttribute("srcdoc");
      if (!source) throw new Error();
      if (frame.isConnected) frame.srcdoc = source;
    })
    .catch(() => {
      if (controller.signal.aborted) return;
      if (frame.isConnected)
        container.innerHTML =
          '<div class="preview-placeholder">预览文件暂时无法载入，请重新加载。</div>';
    })
    .finally(() => previewRequests.delete(controller));
  const width = previewViewport === "mobile" ? 390 : 1200,
    height = previewViewport === "mobile" ? 844 : 800;
  frame.style.width = width + "px";
  frame.style.height = height + "px";
  const resize = () =>
    (frame.style.transform = `scale(${container.clientWidth / width})`);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  observers.set(container, observer);
  resize();
  return () => {
    controller.abort();
    previewRequests.delete(controller);
    observer.disconnect();
    observers.delete(container);
  };
}
function openPreview(item, trigger) {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog preview-dialog";
  dialog.setAttribute("aria-labelledby", "preview-dialog-title");
  dialog.innerHTML = `<div class="dialog-head"><h2 id="preview-dialog-title">${escape(identityOf(item))}</h2><button class="icon-button" aria-label="关闭放大预览" autofocus>×</button></div><div class="preview-dialog-controls"><label>固定测试视口 <select aria-label="放大预览视口"><option value="desktop">桌面 1200 × 800</option><option value="mobile">手机 390 × 844</option></select></label><label>预览方式 <select aria-label="放大预览方式"><option value="image">静态图</option><option value="live">运行预览</option></select></label><button class="button" aria-pressed="true" id="preview-actual-size">原尺寸</button></div><p class="preview-scale-note" id="preview-scale-note"></p><div class="preview-scroll" tabindex="0" role="region" aria-label="放大画布，可滚动查看" aria-describedby="preview-scale-note"><div class="preview-surface"></div></div>`;
  document.body.append(dialog);
  const surface = $(".preview-surface", dialog);
  const view = $('select[aria-label="放大预览视口"]', dialog);
  const format = $('select[aria-label="放大预览方式"]', dialog);
  view.value = viewport;
  format.value = mode;
  let actual = true, dispose;
  const render = () => {
    dispose?.();
    surface.style.width = actual ? (view.value === "mobile" ? "390px" : "1200px") : "100%";
    $("#preview-scale-note", dialog).textContent = actual ? "原尺寸 100%：横向或纵向滚动查看完整画布。" : "适应宽度：固定测试视口等比缩放，不改变作品布局。";
    $("#preview-actual-size", dialog).textContent = actual ? "适应宽度" : "原尺寸";
    $("#preview-actual-size", dialog).setAttribute("aria-pressed", String(!actual));
    dispose = mountPreview(surface, item, { previewViewport: view.value, previewMode: format.value });
  };
  view.addEventListener("change", render);
  format.addEventListener("change", render);
  $("#preview-actual-size", dialog).addEventListener("click", () => { actual = !actual; render(); });
  $(".icon-button", dialog).addEventListener("click", () => dialog.close());
  const position = { x: window.scrollX, y: window.scrollY };
  dialog.addEventListener("close", () => {
    dispose?.();
    dialog.remove();
    trigger.focus({ preventScroll: true });
    window.scrollTo(position.x, position.y);
  }, { once: true });
  dialog.showModal();
  render();
}
function bindViewControls(render) {
  $$("[data-viewport]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.viewport === viewport)),
  );
  $$("[data-mode]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
  );
  $$("[data-viewport]").forEach((b) =>
    b.addEventListener("click", () => {
      viewport = b.dataset.viewport;
      $$("[data-viewport]").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === b)),
      );
      render();
    }),
  );
  $$("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.mode;
      $$("[data-mode]").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === b)),
      );
      render();
    }),
  );
  $("#reload-previews")?.addEventListener("click", () => {
    mode = "live";
    $$("[data-mode]").forEach((x) =>
      x.setAttribute("aria-pressed", String(x.dataset.mode === mode)),
    );
    render();
  });
}
function compare() {
  viewport = params.get("viewport") === "mobile" ? "mobile" : "desktop";
  mode = params.get("mode") === "live" ? "live" : "image";
  let ids = (params.has("ids") ? params.get("ids").split(",") : selected)
    .filter(
      (id, i, all) =>
        submissions.some((s) => s.id === id) && all.indexOf(id) === i,
    )
    .slice(0, 4);
  if (!ids.length && !params.has("ids") && submissions.length >= 2)
    ids = submissions.slice(0, 2).map((s) => s.id);
  ids = Array.from({ length: Math.max(2, ids.length) }, (_, i) => ids[i] || "");
  function render() {
    clearPreviews();
    $("#reload-previews").hidden = mode !== "live";
    const chosen = ids.filter(Boolean);
    selected = chosen;
    saveSelection();
    const url = new URL(location.href);
    url.searchParams.set("ids", chosen.join(","));
    url.searchParams.set("viewport", viewport);
    url.searchParams.set("mode", mode);
    history.replaceState(null, "", url);
    $("#compare-picker").innerHTML = ids
      .map(
        (id, i) =>
          `<div class="compare-slot"><label>作品 ${String(i + 1).padStart(2, "0")}<select data-slot="${i}" aria-describedby="slot-identity-${i}"><option value="">选择作品</option>${groupCatalog(submissions).map(({ provider, models }) => `<optgroup label="${escape(provider)}">${models.flatMap(({ items }) => items).map((s) => `<option value="${s.id}" ${s.id === id ? "selected" : ""} ${ids.includes(s.id) && s.id !== id ? "disabled" : ""}>${escape(s.model)} / ${escape(effortOf(s))}</option>`).join("")}</optgroup>`).join("")}</select><span class="slot-identity" id="slot-identity-${i}">${id ? escape(identityOf(submissions.find((s) => s.id === id))) : "尚未选择"}</span></label>${i >= 2 ? `<button class="button" data-remove-slot="${i}" aria-label="移除作品 ${i + 1}">移除</button>` : ""}</div>`,
      )
      .join("");
    if (ids.length < 4) {
      const add = document.createElement("button");
      add.className = "button add-compare";
      add.id = "add-compare";
      add.textContent = `＋ 添加第 ${ids.length + 1} 项`;
      add.addEventListener("click", () => {
        ids.push("");
        render();
        $(`[data-slot="${ids.length - 1}"]`).focus();
      });
      $("#compare-picker").append(add);
    }
    $$("[data-remove-slot]").forEach((button) => button.addEventListener("click", () => {
      const slot = Number(button.dataset.removeSlot);
      ids.splice(slot, 1);
      render();
      ($(`[data-slot="${slot}"]`) || $("#add-compare")).focus();
    }));
    $$("[data-slot]").forEach((select) =>
      select.addEventListener("change", () => {
        const slot = select.dataset.slot;
        ids[Number(select.dataset.slot)] = select.value;
        render();
        $(`[data-slot="${slot}"]`).focus();
      }),
    );
    const items = chosen.map((id) => submissions.find((s) => s.id === id));
    $("#compare-content").innerHTML =
      items.length >= 2
        ? `<nav class="compare-locator" aria-label="定位对比作品"><label>定位作品 <select id="locate-work"><option value="">选择要查看的画面</option>${items.map((s, i) => `<option value="compare-${s.id}">${i + 1} · ${escape(identityOf(s))}</option>`).join("")}</select></label><a href="#compare-specs">查看详细参数 ↓</a></nav><div class="compare-grid" style="--columns:${items.length}">${items.map((s, i) => `<article class="compare-column"><h2 id="compare-${s.id}" tabindex="-1"><span class="eyebrow">作品 ${i + 1}</span><a href="${detailUrl(s)}">${escape(identityOf(s))}&nbsp;↗</a></h2><div class="preview-block"><button class="button enlarge-preview" data-enlarge="${s.id}" aria-haspopup="dialog" aria-label="放大 ${escape(identityOf(s))}">放大查看</button><div class="preview-surface" data-preview="${s.id}"></div></div></article>`).join("")}</div><details class="compare-specs" id="compare-specs"><summary>详细参数 · ${items.length} 个作品</summary><div class="compare-grid" style="--columns:${items.length}">${items.map((s, i) => `<section><h3>${i + 1} · ${escape(identityOf(s))}</h3>${specs(s)}<a class="text-link" href="#compare-${s.id}">返回作品 ${i + 1} 画面 ↑</a></section>`).join("")}</div></details>`
        : '<div class="empty"><h2>选两只鹈鹕，开始观察。</h2><p>请在上方选择至少两个不同作品。</p><a class="button" href="index.html#gallery">浏览作品</a></div>';
    $("#locate-work")?.addEventListener("change", (event) => {
      const heading = document.getElementById(event.target.value);
      if (heading) { heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: "start" }); }
      event.target.value = "";
    });
    $$("[data-preview]").forEach((el) =>
      mountPreview(
        el,
        items.find((s) => s.id === el.dataset.preview),
      ),
    );
    $$("[data-enlarge]").forEach((button) => button.addEventListener("click", () => openPreview(items.find((s) => s.id === button.dataset.enlarge), button)));
  }
  bindViewControls(render);
  $("#share-compare").addEventListener("click", () => copy(location.href));
  render();
}
function environmentSummary(environment) {
  if (!environment || !Object.keys(environment).length) return '<p class="note">未记录实测环境</p>';
  const fields = [["browser", "浏览器"], ["os", "操作系统"], ["testedAt", "实测日期"], ["desktop", "桌面视口"], ["mobile", "手机视口"], ["dpr", "像素比"], ["captureAt", "截图时机"], ["motion", "动态偏好"]];
  return `<dl class="spec-list">${fields.map(([key, title]) => `<div><dt>${title}</dt><dd>${escape(environment[key] ?? "未记录")}</dd></div>`).join("")}</dl><details><summary>完整观察环境</summary><pre class="code" tabindex="0" aria-label="完整观察环境数据">${escape(JSON.stringify(environment, null, 2))}</pre></details>`;
}
async function entry() {
  mode = "image";
  const item = submissions.find((s) => s.id === params.get("id"));
  if (!item) {
    $("#entry-content").innerHTML =
      '<div class="page-title"><div class="eyebrow">Entry not found</div><h1>这只鹈鹕还没有抵达。</h1><p class="lede">链接中的作品不存在或已更改。可以回到陈列室重新选择。</p><div class="actions"><a class="button primary" href="index.html#gallery">返回作品陈列室 →</a></div></div>';
    return;
  }
  document.title = `${item.title} · 鹈鹕骑车`;
  $("#entry-content").innerHTML =
    `<div class="page-title"><div class="breadcrumbs"><a href="index.html#gallery">作品陈列室</a><span>/</span><span>${escape(item.title)}</span></div><h1>${escape(item.title)}</h1><p class="lede">${escape(item.description)}</p></div>${isDemo(item) ? '<p class="note">这是用于验证站点功能的演示作品，不代表任何模型的参测结果。静态封面为插画，不是实测截图。</p>' : ""}<div class="detail-layout"><div><div class="toolbar"><div class="tabs" aria-label="预览视口"><button class="tab" data-viewport="desktop" aria-pressed="true">桌面 1200 × 800</button><button class="tab" data-viewport="mobile" aria-pressed="false">手机 390 × 844</button></div><div class="tabs" aria-label="预览方式"><button class="tab" data-mode="image" aria-pressed="true">静态图</button><button class="tab" data-mode="live" aria-pressed="false">运行预览</button></div><button class="button" id="reload-previews">重新加载</button><button class="button" id="enlarge-entry" aria-haspopup="dialog">放大查看</button></div><p class="note preview-note">固定测试视口按可用宽度等比缩放；放大可按原尺寸查看细节。</p><div class="preview-surface" id="entry-preview"></div><div class="detail-section"><h2>原始输出</h2><p class="hash">SHA-256 · ${escape(item.sourceSha256)}</p><div class="actions"><button class="button" id="show-source" aria-expanded="false">展开源码</button><button class="button" id="copy-source">复制源码 ⧉</button><a class="button" href="${asset(item, "source.html.txt")}" download>下载原始文本 ↓</a></div><pre class="code" id="source-code" hidden></pre><p class="hash" id="integrity-status" role="status">正在校验原始输出…</p></div><div class="detail-section"><h2>检查与评审</h2><p class="note">${item.staticCheck.passed ? "静态检查通过。此结果不等于浏览器运行、无障碍或性能验收通过。" : "静态检查未通过，运行预览已停用。原始输出仍完整保留。"}</p><ul>${item.staticCheck.issues.map((issue) => `<li>${escape(issue)}</li>`).join("")}</ul>${
      item.review
        ? `<p>评审：${escape(item.review.reviewer)} · ${escape(item.review.date)}</p><table><tbody>${Object.keys(
            weights,
          )
            .map(
              (k) =>
                `<tr><th scope="row">${dimensions[k]}</th><td>${item.review.scores[k]} / 10</td><td>${escape(item.review.notes[k])}</td></tr>`,
            )
            .join("")}</tbody></table>`
        : '<p class="lede">尚无评分或人工评审记录。</p>'
    }</div></div><section class="detail-aside" aria-label="运行档案"><h2>运行档案</h2>${specs(item)}<div class="actions"><button class="button" id="add-to-compare">加入并排对比 →</button><a class="text-link" href="${asset(item, "meta.json")}" download>下载元数据 ↓</a></div><h3 style="margin-top:32px">生成参数</h3><pre class="code">${escape(JSON.stringify(item.parameters, null, 2))}</pre><h3 style="margin-top:26px">观察环境</h3><p class="hash">${escape(item.environment ? JSON.stringify(item.environment, null, 2) : "未记录实测环境")}</p><h3 style="margin-top:26px">完整输入</h3><details><summary>查看本次输入</summary><pre class="code">${escape(item.input)}</pre></details></section></div>`;
  const primary = $(".detail-layout > div");
  const sourceSection = $("#source-code").closest(".detail-section");
  const reviewSection = sourceSection.nextElementSibling;
  const archive = $(".detail-aside");
  const evidence = document.createElement("section");
  evidence.className = "detail-section";
  evidence.innerHTML = `<h2>完整证据</h2>`;
  const parametersHeading = $("h3", archive);
  while (parametersHeading.nextSibling) evidence.append(parametersHeading.nextSibling);
  evidence.insertBefore(parametersHeading, evidence.children[1]);
  // Keep core identity immediately after the preview, ahead of conclusions and source.
  primary.after(archive);
  archive.after(reviewSection);
  reviewSection.after(sourceSection);
  sourceSection.after(evidence);
  const environmentHeading = $$("h3", evidence).find((h) => h.textContent === "观察环境");
  environmentHeading.nextElementSibling.outerHTML = environmentSummary(item.environment);
  $("#enlarge-entry").addEventListener("click", (event) => openPreview(item, event.currentTarget));
  $("#add-to-compare").addEventListener("click", () => {
    if (!selected.includes(item.id)) {
      if (selected.length >= 4) {
        notify("最多对比 4 个作品，请先在陈列室或对比页移除一个作品");
        return;
      }
      selected.push(item.id);
    }
    saveSelection();
    location.href = `compare.html?ids=${selected.join(",")}`;
  });
  if (item.runtimeChecks?.length) {
    const section = document.createElement("section");
    section.className = "detail-section";
    section.innerHTML = `<h2>浏览器实测记录</h2><p class="lede">${escape(item.environment?.browser || "浏览器未记录")} · ${escape(item.environment?.testedAt?.slice(0, 10) || "日期未记录")}。这些结果记录运行行为，不代替画面质量评分。</p><table><thead><tr><th scope="col">检查项</th><th scope="col">结果</th><th scope="col">记录</th></tr></thead><tbody>${item.runtimeChecks.map((check) => `<tr><th scope="row">${escape(check.name)}</th><td><span class="badge ${check.status === "fail" ? "failed" : ""}">${escape({ pass: "通过", fail: "未通过", "not-tested": "待复查" }[check.status] || "未记录")}</span></td><td><details><summary>查看</summary><p class="hash">${escape(check.detail)}</p></details></td></tr>`).join("")}</tbody></table>`;
    reviewSection.before(section);
  }
  else {
    const missing = document.createElement("p");
    missing.className = "note";
    missing.textContent = "尚无浏览器实测记录。";
    reviewSection.prepend(missing);
  }
  if (item.provenance) {
    const section = document.createElement("section");
    section.className = "detail-section";
    section.innerHTML = `<h3>来源记录</h3><p class="hash">${escape(item.provenance.promptVerification || "输入来源未记录")}</p><p class="hash">${escape(item.provenance.note || "")}</p><details><summary>完整运行信息</summary><pre class="code">${escape(JSON.stringify(item.provenance, null, 2))}</pre></details>`;
    evidence.append(section);
  }
  const render = () => {
    clearPreviews();
    $("#reload-previews").hidden = mode !== "live";
    mountPreview($("#entry-preview"), item);
  };
  bindViewControls(render);
  render();
  let source;
  try {
    const response = await fetch(asset(item, "source.html.txt"), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error();
    const bytes = await response.arrayBuffer();
    source = new TextDecoder().decode(bytes);
    $("#source-code").textContent = source;
    const digest = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (digest !== item.sourceSha256) throw new Error();
    $("#integrity-status").textContent = "原始输出 SHA-256 校验一致";
  } catch {
    $("#integrity-status").textContent =
      "原始输出读取或哈希校验失败，请核对仓库文件。";
  }
  $("#show-source").addEventListener("click", () => {
    const code = $("#source-code");
    code.hidden = !code.hidden;
    $("#show-source").setAttribute("aria-expanded", String(!code.hidden));
    $("#show-source").textContent = code.hidden ? "展开源码" : "收起源码";
  });
  $("#copy-source").addEventListener("click", () =>
    source === undefined ? notify("源码未载入，请刷新后重试") : copy(source),
  );
}
const page = document.body.dataset.page;
const promptTask = json("data/prompt.v1.json").then((value) => {
  if (typeof value.text !== "string" || typeof value.sha256 !== "string") throw new Error("Invalid prompt");
  prompt = value;
  $("#dialog-prompt").textContent = prompt.text;
  $("#dialog-hash").textContent = `SHA-256 · ${prompt.sha256}`;
  if ($("#method-prompt")) {
    $("#method-prompt").textContent = prompt.text;
    $("#prompt-hash").textContent = `SHA-256 · ${prompt.sha256}`;
  }
}).catch(() => {
  if ($("#method-prompt")) $("#method-prompt").textContent = "提示词暂时无法载入，请刷新重试。";
  notify("提示词暂时无法载入，作品浏览不受影响");
});
try {
  submissions = page === "method" ? [] : await json("data/submissions.json");
  if (!Array.isArray(submissions)) throw new Error("Invalid index");
  submissions = submissions
    .filter((s) => safeId(s.id))
    .sort((a, b) => Number(isDemo(a)) - Number(isDemo(b)));
  try {
    const stored = JSON.parse(
      sessionStorage.getItem("pelican-selection") || "[]",
    );
    if (Array.isArray(stored))
      selected = [
        ...new Set(stored.filter((id) => submissions.some((s) => s.id === id))),
      ].slice(0, 4);
  } catch {}
  if (page === "index") home();
  else if (page === "compare") compare();
  else if (page === "entry") await entry();
} catch {
  const target = $("#cards") || $("#compare-content") || $("#entry-content");
  if (target)
    target.innerHTML =
      '<div class="empty"><h2>作品数据暂时无法载入。</h2><p>请检查连接后重试。</p><button class="button" id="retry-data">重新加载</button></div>';
  $("#retry-data")?.addEventListener("click", () => location.reload());
  if ($("#result-count")) $("#result-count").textContent = "读取失败";
  notify("未能读取站点数据，请刷新后重试");
}
await promptTask;
