export function createTopNavigationMarker() {
  const linkSelector = ".VPNavBarMenuLink";
  let menu: HTMLElement | undefined;
  let marker: HTMLSpanElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let navigationObserver: MutationObserver | undefined;
  let markerFrame = 0;

  function isVisible(element: HTMLElement) {
    return element.getClientRects().length > 0;
  }

  function activeLink() {
    const active = menu?.querySelector<HTMLElement>(`${linkSelector}.active`);
    return active && isVisible(active) ? active : undefined;
  }

  function moveMarker(target: HTMLElement) {
    if (!menu || !marker || !isVisible(target)) return;

    const menuRect = menu.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const styles = window.getComputedStyle(target);
    const insetLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const insetRight = Number.parseFloat(styles.paddingRight) || 0;
    const x = targetRect.left - menuRect.left + insetLeft;
    const y = targetRect.bottom - menuRect.top - 6;
    const width = Math.max(0, targetRect.width - insetLeft - insetRight);
    const isReady = marker.classList.contains("is-ready");

    if (!isReady) marker.classList.add("is-preparing");
    marker.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    marker.style.width = `${width}px`;
    marker.classList.add("is-visible");

    if (!isReady) {
      void marker.offsetWidth;
      marker.classList.remove("is-preparing");
      marker.classList.add("is-ready");
    }
  }

  function scheduleSync() {
    if (markerFrame) window.cancelAnimationFrame(markerFrame);
    markerFrame = window.requestAnimationFrame(() => {
      markerFrame = 0;
      const active = activeLink();
      if (active) moveMarker(active);
      else marker?.classList.remove("is-visible");
    });
  }

  function eventLink(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return undefined;
    const link = target.closest<HTMLElement>(linkSelector);
    return link && menu?.contains(link) ? link : undefined;
  }

  function handlePointerOver(event: PointerEvent) {
    const link = eventLink(event.target);
    if (link) moveMarker(link);
  }

  function handlePointerLeave() {
    scheduleSync();
  }

  function handleFocusIn(event: FocusEvent) {
    const link = eventLink(event.target);
    if (link) moveMarker(link);
  }

  function handleFocusOut(event: FocusEvent) {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !menu?.contains(nextTarget)) {
      scheduleSync();
    }
  }

  function attach() {
    if (menu?.isConnected && marker?.isConnected) return;

    const nextMenu = document.querySelector<HTMLElement>(".VPNavBarMenu");
    if (!nextMenu) return;

    menu = nextMenu;
    marker = document.createElement("span");
    marker.className = "top-nav-marker";
    marker.setAttribute("aria-hidden", "true");
    menu.append(marker);

    menu.addEventListener("pointerover", handlePointerOver);
    menu.addEventListener("pointerleave", handlePointerLeave);
    menu.addEventListener("focusin", handleFocusIn);
    menu.addEventListener("focusout", handleFocusOut);

    resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(menu);

    navigationObserver = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.type === "childList" ||
            (record.target instanceof HTMLElement &&
              record.target.matches(linkSelector))
        )
      ) {
        scheduleSync();
      }
    });
    navigationObserver.observe(menu, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true
    });
  }

  function detach() {
    if (markerFrame) window.cancelAnimationFrame(markerFrame);
    markerFrame = 0;
    resizeObserver?.disconnect();
    navigationObserver?.disconnect();

    if (menu) {
      menu.removeEventListener("pointerover", handlePointerOver);
      menu.removeEventListener("pointerleave", handlePointerLeave);
      menu.removeEventListener("focusin", handleFocusIn);
      menu.removeEventListener("focusout", handleFocusOut);
    }

    marker?.remove();
    menu = undefined;
    marker = undefined;
    resizeObserver = undefined;
    navigationObserver = undefined;
  }

  return {
    mount() {
      attach();
      window.addEventListener("resize", scheduleSync, { passive: true });
      scheduleSync();
    },
    sync() {
      if (!menu?.isConnected || !marker?.isConnected) {
        detach();
        attach();
      }
      scheduleSync();
    },
    destroy() {
      window.removeEventListener("resize", scheduleSync);
      detach();
    }
  };
}
