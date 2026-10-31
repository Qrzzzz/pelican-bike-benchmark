// The only adapter that depends on VitePress default-theme DOM structure.
export function createNavigationAccessibility() {
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");

  type InertState = {
    inert: boolean;
    ariaHidden: string | null;
  };

  let accessibilityObserver: MutationObserver | undefined;
  let activeNavScreen: HTMLElement | undefined;
  let navScreenTrigger: HTMLButtonElement | undefined;
  let focusFrame = 0;
  const navBackgroundState = new Map<HTMLElement, InertState>();
  const languageParts = new Set<HTMLElement>();
  const shellLabelState = new Map<
    HTMLElement,
    { text?: string | null; ariaLabel?: string | null }
  >();

  function setElementInert(element: HTMLElement, inert: boolean) {
    element.inert = inert;
    if (inert) element.setAttribute("aria-hidden", "true");
    else element.removeAttribute("aria-hidden");
  }

  function setShellLanguageParts() {
    for (const element of languageParts) {
      if (!element.isConnected) languageParts.delete(element);
    }
    for (const element of shellLabelState.keys()) {
      if (!element.isConnected) shellLabelState.delete(element);
    }

    document
      .querySelectorAll<HTMLElement>(
        ".VPSkipLink, .VPNav, .VPLocalNav, .VPFooter, .docs-breadcrumb"
      )
      .forEach((element) => {
        element.lang = "en";
        languageParts.add(element);
      });

    const textLabels = [
      ["#main-nav-aria-label", "Main navigation"],
      ["#doc-footer-aria-label", "Pagination navigation"]
    ] as const;
    for (const [selector, text] of textLabels) {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) continue;
      if (!shellLabelState.has(element)) {
        shellLabelState.set(element, {
          text: element.textContent
        });
      }
      if (element.textContent !== text) element.textContent = text;
    }

    const hamburger = document.querySelector<HTMLButtonElement>(".VPNavBarHamburger");
    if (hamburger) {
      if (!shellLabelState.has(hamburger)) {
        shellLabelState.set(hamburger, {
          ariaLabel: hamburger.getAttribute("aria-label")
        });
      }
      hamburger.setAttribute("aria-label", "Mobile navigation");
    }
  }

  function navFocusables(screen: HTMLElement, trigger: HTMLButtonElement) {
    return [trigger, ...screen.querySelectorAll<HTMLElement>(focusableSelector)].filter(
      (element) =>
        !element.inert &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.getClientRects().length > 0
    );
  }

  function handleNavScreenKeydown(event: KeyboardEvent) {
    if (!activeNavScreen || !navScreenTrigger) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      navScreenTrigger.click();
      navScreenTrigger.focus();
      return;
    }

    if (event.key !== "Tab") return;
    const focusables = navFocusables(activeNavScreen, navScreenTrigger);
    if (!focusables.length) return;
    const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusables.length - 1
        : currentIndex - 1
      : currentIndex < 0 || currentIndex === focusables.length - 1
        ? 0
        : currentIndex + 1;

    event.preventDefault();
    focusables[nextIndex].focus();
  }

  function activateNavScreen(screen: HTMLElement, trigger: HTMLButtonElement) {
    activeNavScreen = screen;
    navScreenTrigger = trigger;
    screen.setAttribute("role", "dialog");
    screen.setAttribute("aria-modal", "true");
    screen.setAttribute("aria-label", "Mobile navigation");
    screen.lang = "en";

    document
      .querySelectorAll<HTMLElement>(
        [
          ".site-layout .Layout > :not(.VPNav)",
          ".VPNavBarTitle",
          ".InlineSiteSearch",
          ".VPNavBarSearch",
          ".VPNavBarMenu",
          ".VPNavBarTranslations",
          ".VPNavBarAppearance",
          ".VPNavBarSocialLinks",
          ".VPNavBarExtra",
          ".NavActions"
        ].join(",")
      )
      .forEach((element) => {
        navBackgroundState.set(element, {
          inert: element.inert,
          ariaHidden: element.getAttribute("aria-hidden")
        });
        setElementInert(element, true);
      });

    document.addEventListener("keydown", handleNavScreenKeydown, true);
    focusFrame = window.requestAnimationFrame(() => {
      focusFrame = 0;
      const target = navFocusables(screen, trigger).find((element) => element !== trigger) ?? screen;
      if (target === screen) screen.tabIndex = -1;
      target.focus();
    });
  }

  function deactivateNavScreen(returnFocus = true) {
    if (!activeNavScreen) return;
    if (focusFrame) window.cancelAnimationFrame(focusFrame);
    focusFrame = 0;
    document.removeEventListener("keydown", handleNavScreenKeydown, true);

    for (const [element, state] of navBackgroundState) {
      element.inert = state.inert;
      if (state.ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", state.ariaHidden);
    }
    navBackgroundState.clear();

    activeNavScreen.removeAttribute("role");
    activeNavScreen.removeAttribute("aria-modal");
    activeNavScreen.removeAttribute("aria-label");
    activeNavScreen.removeAttribute("tabindex");
    const trigger = navScreenTrigger;
    activeNavScreen = undefined;
    navScreenTrigger = undefined;
    if (returnFocus) trigger?.focus();
  }

  function syncNavigationAccessibility() {
    setShellLanguageParts();

    const sidebar = document.querySelector<HTMLElement>(".VPSidebar");
    if (sidebar) {
      const isMobileSidebar = window.matchMedia("(max-width: 959px)").matches;
      setElementInert(sidebar, isMobileSidebar && !sidebar.classList.contains("open"));
    }

    const screen = document.querySelector<HTMLElement>(".VPNavScreen");
    const trigger = document.querySelector<HTMLButtonElement>(".VPNavBarHamburger");
    if (screen && trigger && !activeNavScreen) activateNavScreen(screen, trigger);
    else if (!screen && activeNavScreen) deactivateNavScreen();
  }

  let updateFrame = 0;
  function scheduleSync() {
    if (!updateFrame) updateFrame = window.requestAnimationFrame(() => { updateFrame = 0; syncNavigationAccessibility(); });
  }
  function observeShell() {
    accessibilityObserver?.disconnect();
    for (const element of document.querySelectorAll(".VPNav, .VPSidebar")) {
      accessibilityObserver?.observe(element, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
    }
  }
  return {
    mount() {
      accessibilityObserver = new MutationObserver(scheduleSync);
      observeShell();
      window.addEventListener("resize", scheduleSync, { passive: true });
      syncNavigationAccessibility();
    },
    sync() { observeShell(); syncNavigationAccessibility(); },
    destroy() {
      accessibilityObserver?.disconnect();
      window.removeEventListener("resize", scheduleSync);
      if (updateFrame) window.cancelAnimationFrame(updateFrame);
      deactivateNavScreen(false);
      for (const element of languageParts) {
        if (element.lang === "en") element.removeAttribute("lang");
      }
      languageParts.clear();
      for (const [element, state] of shellLabelState) {
        if ("text" in state) element.textContent = state.text ?? "";
        if ("ariaLabel" in state) {
          if (state.ariaLabel === null) element.removeAttribute("aria-label");
          else element.setAttribute("aria-label", state.ariaLabel ?? "");
        }
      }
      shellLabelState.clear();
    }
  };
}
