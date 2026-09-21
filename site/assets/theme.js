(() => {
  const system = matchMedia("(prefers-color-scheme: dark)");
  let saved;
  try { saved = localStorage.getItem("pelican-theme"); } catch {}
  const apply = () => {
    const theme = saved === "dark" || saved === "light"
      ? saved : system.matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.append(meta);
    }
    meta.content = theme === "dark" ? "#151d37" : "#eef2f3";
    document.dispatchEvent(new Event("themechange"));
  };
  window.setPelicanTheme = (theme) => {
    saved = theme;
    try { localStorage.setItem("pelican-theme", theme); } catch {}
    apply();
  };
  system.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key === "pelican-theme" || event.key === null) {
      saved = event.newValue;
      apply();
    }
  });
  apply();
})();
