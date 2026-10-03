// Native adaptation of personal-docs topNavigationMarker and InlineSearch.
export function initNavigation() {
  const header = document.querySelector(".header");
  const inner = header.querySelector(".header-inner");
  const menu = inner.querySelector("nav");
  menu.classList.add("desktop-nav");
  const tools = inner.querySelector(".NavActions");
  const content = document.createElement("div");
  content.className = "header-content";
  inner.append(content);
  content.append(menu, tools);
  const search = document.createElement("div");
  search.className = "InlineSiteSearch";
  const icon = '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>';
  search.innerHTML = `<button type="button" class="inline-search-trigger" aria-label="搜索本站" aria-expanded="false" aria-controls="inline-search-form" title="搜索本站（Ctrl K）">${icon}</button><form id="inline-search-form" class="inline-search-form" role="search" hidden>${icon}<input id="inline-site-search-input" type="search" role="combobox" aria-label="搜索本站" aria-autocomplete="list" aria-controls="inline-search-results" aria-expanded="false" autocomplete="off" maxlength="64" placeholder="搜索作品与测试方法…"><button type="button" class="inline-search-action" aria-label="清除搜索" hidden>×</button><button type="button" class="inline-search-action inline-search-close" aria-label="关闭搜索">Esc</button></form><div class="inline-search-panel" hidden><p class="inline-search-state" role="status"></p><ul id="inline-search-results" role="listbox" aria-label="搜索结果"></ul></div>`;
  content.prepend(search);
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "nav-hamburger";
  trigger.setAttribute("aria-label", "站点导航");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "nav-screen");
  trigger.innerHTML = '<span class="hamburger-lines" aria-hidden="true"><span></span><span></span><span></span></span>';
  content.append(trigger);
  const screen = document.createElement("div");
  screen.id = "nav-screen";
  screen.className = "nav-screen";
  screen.hidden = true;
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-label", "站点导航");
  const mobileMenu = menu.cloneNode(true);
  mobileMenu.className = "mobile-nav";
  screen.append(mobileMenu);
  header.append(screen);
  header.classList.add("navigation-ready");

  let savedInert = new Map();
  function closeMenu(restoreFocus = true) {
    screen.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    header.classList.remove("screen-open");
    savedInert.forEach((value, el) => { el.inert = value; });
    savedInert.clear();
    if (restoreFocus) trigger.focus();
  }
  trigger.addEventListener("click", () => {
    if (!screen.hidden) return closeMenu();
    screen.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    header.classList.add("screen-open");
    savedInert = new Map();
    const background = [...document.body.children].filter(el => el !== header);
    background.push(inner.querySelector(".home-link"), search, menu, tools);
    background.forEach(el => { savedInert.set(el, el.inert); el.inert = true; });
    mobileMenu.querySelector("a").focus();
  });
  mobileMenu.addEventListener("click", event => { if (event.target.closest("a")) closeMenu(false); });
  header.addEventListener("keydown", event => {
    if (screen.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); closeMenu(); }
    if (event.key === "Tab") {
      const focusables = [trigger, ...mobileMenu.querySelectorAll("a")];
      const i = focusables.indexOf(document.activeElement);
      event.preventDefault();
      focusables[(i + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus();
    }
  });
  matchMedia("(min-width: 1080px)").addEventListener("change", event => { if (event.matches && !screen.hidden) closeMenu(false); });

  const marker = document.createElement("span");
  marker.className = "top-nav-marker";
  marker.setAttribute("aria-hidden", "true");
  menu.append(marker);
  function moveMarker(link) {
    if (!link || !link.getClientRects().length) { marker.classList.remove("is-visible"); return; }
    const parent = menu.getBoundingClientRect(), rect = link.getBoundingClientRect();
    const style = getComputedStyle(link);
    const left = parseFloat(style.paddingLeft) || 0, right = parseFloat(style.paddingRight) || 0;
    marker.style.transform = `translate3d(${rect.left - parent.left + left}px, ${rect.bottom - parent.top - 6}px, 0)`;
    marker.style.width = `${Math.max(0, rect.width - left - right)}px`;
    marker.classList.add("is-visible");
  }
  const sync = () => moveMarker(menu.querySelector('[aria-current="page"]'));
  for (const name of ["pointerover", "focusin"]) menu.addEventListener(name, event => { const link = event.target.closest("a"); if (link) moveMarker(link); });
  menu.addEventListener("pointerleave", sync);
  menu.addEventListener("focusout", event => { if (!menu.contains(event.relatedTarget)) sync(); });
  new ResizeObserver(sync).observe(menu);
  document.fonts.ready.then(sync);
  sync();

  const searchTrigger = search.querySelector(".inline-search-trigger");
  const form = search.querySelector("form"), input = search.querySelector("input");
  const panel = search.querySelector(".inline-search-panel"), list = search.querySelector("ul"), status = search.querySelector(".inline-search-state");
  const clear = search.querySelector('[aria-label="清除搜索"]');
  let index, loading, results = [], selected = -1;
  function select(i) {
    selected = i;
    [...list.children].forEach((li, j) => { li.setAttribute("aria-selected", String(i === j)); });
    if (i >= 0) { input.setAttribute("aria-activedescendant", `inline-search-item-${i}`); list.children[i]?.scrollIntoView({block:"nearest"}); }
    else input.removeAttribute("aria-activedescendant");
  }
  async function loadIndex() {
    if (index) return index;
    if (!loading) loading = (async () => {
      const response = await fetch("data/submissions.json", {signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error("Search unavailable");
      const entries = await response.json();
      const documents = [
        ["测试方法", "method.html", "固定提示词 评分维度 观察环境 添加作品 边界 限制"],
        ["作品陈列室", "index.html", "模型 厂家 推理强度 作品"],
        ["并排对比", "compare.html", "桌面 手机 对比"],
      ].map(([title, url, text]) => ({title, url, text, context:"站内页面"}));
      index = [...documents, ...entries.filter(e => /^[a-z0-9][a-z0-9-]{0,79}$/.test(e.id)).map(e => ({title:e.title, url:`entry.html?id=${encodeURIComponent(e.id)}`, context:[e.modelProvider, e.model, e.parameters?.reasoningEffort].filter(Boolean).join(" · "), text:[e.title,e.description,e.modelProvider,e.model,e.version,e.parameters?.reasoningEffort].join(" ")}))];
      return index;
    })().finally(() => { loading = undefined; });
    return loading;
  }
  async function renderResults() {
    const query = input.value.trim().toLocaleLowerCase();
    clear.hidden = !query;
    panel.hidden = !query;
    input.setAttribute("aria-expanded", String(Boolean(query)));
    list.replaceChildren(); select(-1);
    if (!query) return;
    status.hidden = false; status.textContent = "正在读取搜索索引…";
    try {
      const records = await loadIndex();
      if (query !== input.value.trim().toLocaleLowerCase()) return;
      results = records.filter(e => query.split(/\s+/).every(part => `${e.title} ${e.text}`.toLocaleLowerCase().includes(part))).slice(0, 12);
      status.textContent = results.length ? `${results.length} 个结果` : `没有找到“${input.value.trim()}”`;
      results.forEach((result, i) => {
        const li = document.createElement("li"); li.id = `inline-search-item-${i}`; li.setAttribute("role", "option"); li.setAttribute("aria-selected", "false");
        const a = document.createElement("a"); a.className = "inline-search-result"; a.href = result.url;
        const context = document.createElement("span"); context.className = "inline-search-context"; context.textContent = result.context;
        const title = document.createElement("strong"); title.textContent = result.title;
        a.append(context, title); li.append(a); list.append(li);
        a.addEventListener("pointerenter", () => select(i)); a.addEventListener("focus", () => select(i));
      });
    } catch { status.textContent = "搜索暂时不可用，请重新输入以重试。"; }
  }
  function closeSearch(focus = true) {
    search.classList.remove("is-expanded"); form.hidden = true; panel.hidden = true; searchTrigger.hidden = false;
    searchTrigger.setAttribute("aria-expanded", "false");
    [menu,tools,trigger,inner.querySelector('.home-link')].forEach(el => { el.inert = false; });
    if (focus) searchTrigger.focus();
  }
  function openSearch() {
    if (!screen.hidden) closeMenu(false);
    search.classList.add("is-expanded"); form.hidden = false; searchTrigger.hidden = true;
    searchTrigger.setAttribute("aria-expanded", "true");
    [menu,tools,trigger].forEach(el => { el.inert = true; });
    inner.querySelector('.home-link').inert = matchMedia('(max-width:680px)').matches;
    input.focus(); renderResults();
  }
  searchTrigger.addEventListener("click", openSearch);
  search.querySelector('[aria-label="关闭搜索"]').addEventListener("click", () => closeSearch());
  clear.addEventListener("click", () => { input.value = ""; renderResults(); input.focus(); });
  input.addEventListener("input", renderResults);
  form.addEventListener("submit", event => { event.preventDefault(); if (selected >= 0 && results[selected]) location.href = results[selected].url; });
  input.addEventListener("keydown", event => {
    if (["ArrowDown", "ArrowUp"].includes(event.key) && results.length && !panel.hidden) {
      event.preventDefault(); select((selected + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    }
  });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
    else if (event.key === "Escape" && search.classList.contains("is-expanded")) { event.preventDefault(); closeSearch(); }
  });
  document.addEventListener("pointerdown", event => { if (search.classList.contains("is-expanded") && !search.contains(event.target)) closeSearch(false); });
  const resizeSearch = () => {
    const view = window.visualViewport;
    search.style.setProperty("--search-viewport-top", `${(view?.offsetTop || 0) + 10}px`);
    search.style.setProperty("--search-panel-height", `${Math.max(80, (view?.height || innerHeight) - 76)}px`);
  };
  window.visualViewport?.addEventListener("resize", resizeSearch);
  window.visualViewport?.addEventListener("scroll", resizeSearch);
  resizeSearch();
}
