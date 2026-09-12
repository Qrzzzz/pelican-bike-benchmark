try {
  const saved = localStorage.getItem("pelican-theme");
  document.documentElement.dataset.theme =
    saved === "dark" || saved === "light"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
} catch {
  /* System colors remain available when storage is disabled. */
}
