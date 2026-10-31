<script setup lang="ts">
import SiteIcon from "./SiteIcon.vue";
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useData } from "vitepress";

const { page } = useData();
const visible = ref(false);
const scrolling = ref(false);
const bottom = ref(20);
let motionFrame = 0;
let frame = 0;

function updateScrollState() {
  frame = 0;
  const threshold = Math.min(760, Math.max(520, window.innerHeight * 0.72));
  visible.value = scrolling.value || window.scrollY >= threshold;
  const footer = document.querySelector(".VPFooter")?.getBoundingClientRect();
  bottom.value = footer ? Math.max(20, window.innerHeight - footer.top + 16) : 20;
}

function scheduleUpdate() {
  if (frame) return;
  frame = window.requestAnimationFrame(updateScrollState);
}

function focusPageHeading() {
  const heading = document.querySelector<HTMLElement>(".vp-doc h1, .vp-doc .excerpt-entry");
  if (!heading) return;

  const previousTabIndex = heading.getAttribute("tabindex");
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  heading.addEventListener(
    "blur",
    () => {
      if (previousTabIndex === null) heading.removeAttribute("tabindex");
      else heading.setAttribute("tabindex", previousTabIndex);
    },
    { once: true }
  );
}

function cancelScroll() {
  if (motionFrame) window.cancelAnimationFrame(motionFrame);
  motionFrame = 0;
  scrolling.value = false;
  updateScrollState();
}

function interruptScroll(event: KeyboardEvent) {
  if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Tab"].includes(event.key)) cancelScroll();
}

function returnToTop() {
  cancelScroll();
  const librarySearch = document.querySelector<HTMLInputElement>(".library-search input");
  const start = window.scrollY;
  const target = librarySearch
    ? Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight,
        start + librarySearch.getBoundingClientRect().top - (window.innerHeight - librarySearch.offsetHeight) / 2))
    : 0;
  const finish = () => {
    motionFrame = 0;
    scrolling.value = false;
    if (librarySearch) librarySearch.focus({ preventScroll: true });
    else focusPageHeading();
    updateScrollState();
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(start - target) < 2) {
    window.scrollTo({ top: target, behavior: "instant" });
    finish();
    return;
  }
  scrolling.value = true;
  const duration = Math.min(1050, Math.max(520, 360 + Math.sqrt(Math.abs(start - target)) * 9));
  const started = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - started) / duration);
    const eased = t < .5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
    window.scrollTo({ top: start + (target - start) * eased, behavior: "instant" });
    if (t < 1) motionFrame = window.requestAnimationFrame(step);
    else finish();
  };
  motionFrame = window.requestAnimationFrame(step);
}

onMounted(() => {
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("wheel", cancelScroll, { passive: true });
  window.addEventListener("touchstart", cancelScroll, { passive: true });
  window.addEventListener("keydown", interruptScroll);
  updateScrollState();
});

watch(
  () => page.value.relativePath,
  () => { cancelScroll(); nextTick(updateScrollState); },
  { flush: "post" }
);

onBeforeUnmount(() => {
  window.removeEventListener("scroll", scheduleUpdate);
  window.removeEventListener("resize", scheduleUpdate);
  if (frame) window.cancelAnimationFrame(frame);
  if (motionFrame) window.cancelAnimationFrame(motionFrame);
  window.removeEventListener("wheel", cancelScroll);
  window.removeEventListener("touchstart", cancelScroll);
  window.removeEventListener("keydown", interruptScroll);
});
</script>

<template>
  <button
    class="back-to-top"
    type="button"
    :class="{ 'is-visible': visible, 'is-scrolling': scrolling }"
    :style="{ '--back-top-offset': `${bottom}px` }"
    :disabled="!visible"
    :tabindex="visible ? 0 : -1"
    :aria-hidden="!visible"
    :aria-label="page.relativePath === 'library/index.md' ? 'Back to filters' : 'Back to top'"
    :title="page.relativePath === 'library/index.md' ? 'Back to filters' : 'Back to top'"
    @click="returnToTop"
  >
    <SiteIcon name="arrow-up" class="back-to-top__icon" />
  </button>
</template>
