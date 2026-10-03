export function canAnimateThemeTransition(documentObject, windowObject, origin) {
  return Boolean(
    origin &&
      documentObject?.documentElement &&
      !windowObject?.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export async function runThemeTransition({
  documentObject,
  windowObject,
  origin,
  update,
  duration = 260
}) {
  let didUpdate = false;
  const applyUpdate = async () => {
    if (didUpdate) return;
    didUpdate = true;
    await update();
  };

  if (!canAnimateThemeTransition(documentObject, windowObject, origin)) {
    await applyUpdate();
    return false;
  }

  const root = documentObject.documentElement;

  if (
    typeof documentObject.startViewTransition !== "function" ||
    typeof root.animate !== "function"
  ) {
    root.classList.add("theme-is-switching");
    try { await applyUpdate(); }
    finally {
      windowObject.setTimeout(() => root.classList.remove("theme-is-switching"), duration);
    }
    return true;
  }

  try {
    const transition = documentObject.startViewTransition(applyUpdate);
    await transition.ready;
    root.animate(
      { opacity: [1, 0] },
      {
        duration,
        easing: "cubic-bezier(.2, .7, .25, 1)",
        fill: "both",
        pseudoElement: "::view-transition-old(root)"
      }
    );
    return true;
  } catch {
    await applyUpdate();
    return false;
  }
}
