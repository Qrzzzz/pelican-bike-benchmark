// Native outline for both static documentation and generated entry records.
export function initDocument(root) {
  if (!root?.querySelector("h2")) return;
  const layout = document.createElement("div");
  layout.className = "document-layout";
  const body = document.createElement("div");
  body.className = "document-body";
  while (root.firstChild) body.append(root.firstChild);
  layout.append(body);
  root.append(layout);
  const headings = [...body.querySelectorAll("h2, h3")];
  const outline = document.createElement("aside");
  outline.className = "document-outline";
  outline.setAttribute("aria-label", "本页导航");
  outline.innerHTML = '<details open><summary>本页导航</summary><div class="document-outline__title">本页导航</div><nav aria-label="页面章节"></nav></details>';
  const nav = outline.querySelector("nav");
  const links = headings.map((heading, i) => {
    const section = heading.parentElement;
    if (!heading.id) heading.id = section.matches("section[id]") ? `${section.id}-heading` : `document-heading-${i + 1}`;
    heading.tabIndex = -1;
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    link.dataset.level = heading.tagName.slice(1);
    nav.append(link);
    link.addEventListener("click", () => {
      if (matchMedia("(max-width: 959px)").matches) outline.querySelector("details").open = false;
      // Wait until the collapsed outline has changed the anchor's position.
      requestAnimationFrame(() => {
        heading.scrollIntoView({ block: "start" });
        heading.focus({ preventScroll: true });
        update();
      });
    });
    return link;
  });
  layout.append(outline);
  const media = matchMedia("(min-width: 960px)");
  const responsive = () => { outline.querySelector("details").open = media.matches; };
  media.addEventListener("change", responsive);
  responsive();
  let frame = 0;
  function update() {
    frame = 0;
    let active = 0;
    const offset = matchMedia("(min-width: 960px)").matches ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height")) + 80 : 80;
    headings.forEach((heading, i) => { if (heading.getBoundingClientRect().top <= offset) active = i; });
    if (scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) active = headings.length - 1;
    links.forEach((link, i) => {
      if (i === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("hashchange", schedule);
  new ResizeObserver(schedule).observe(body);
  if (location.hash) requestAnimationFrame(() => {
    let id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch { return; }
    const target = document.getElementById(id);
    if (target && body.contains(target)) target.scrollIntoView();
  });
  update();
}
