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
  duration = 320
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
    root.classList.add("theme-fade-out");
    await new Promise((resolve) => windowObject.setTimeout(resolve, duration * 0.45));
    await applyUpdate();
    root.classList.remove("theme-fade-out");
    root.classList.add("theme-fade-in");
    windowObject.setTimeout(() => {
      root.classList.remove("theme-fade-in");
    }, duration * 0.55);
    return true;
  }

  try {
    const transition = documentObject.startViewTransition(applyUpdate);
    await transition.ready;
    root.animate(
      { opacity: [1, 0] },
      {
        duration,
        easing: "cubic-bezier(0.4, 0, 1, 1)",
        fill: "both",
        pseudoElement: "::view-transition-old(root)"
      }
    );
    root.animate(
      { opacity: [0, 1] },
      {
        duration,
        easing: "cubic-bezier(0, 0, 0.2, 1)",
        fill: "both",
        pseudoElement: "::view-transition-new(root)"
      }
    );
    await transition.finished;
    return true;
  } catch {
    await applyUpdate();
    return false;
  }
}
