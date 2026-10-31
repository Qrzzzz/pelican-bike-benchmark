<script setup lang="ts">
import SiteIcon from "./SiteIcon.vue";
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { useData } from "vitepress";
import {
  runThemeTransition
} from "./themeTransitionRuntime.mjs";

const { isDark } = useData();
const toggleButton = ref<HTMLButtonElement>();
const switching = ref(false);
let resetTimer = 0;

const toggleLabel = computed(() =>
  isDark.value ? "Switch to light theme" : "Switch to dark theme"
);

async function toggleTheme(event: MouseEvent) {
  if (switching.value) return;
  switching.value = true;
  const targetIsDark = !isDark.value;

  try {
    await runThemeTransition({
      documentObject: document,
      windowObject: window,
      origin: toggleButton.value,
      update: async () => {
        isDark.value = targetIsDark;
        await nextTick();
      }
    });
  } finally {
    window.clearTimeout(resetTimer);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resetDelay = reducedMotion ? 0 : typeof document.startViewTransition === "function" ? 60 : 360;
    resetTimer = window.setTimeout(() => {
      switching.value = false;
      document.documentElement.classList.remove("theme-is-switching");
    }, resetDelay);
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(resetTimer);
  document.documentElement.classList.remove(
    "theme-is-switching",
    "theme-fade-out",
    "theme-fade-in"
  );
});
</script>

<template>
  <div class="NavActions" role="group" aria-label="Site tools">
    <button
      ref="toggleButton"
      type="button"
      class="theme-toggle"
      :class="{ 'is-switching': switching }"
      role="switch"
      :aria-label="toggleLabel"
      :aria-checked="isDark"
      :title="toggleLabel"
      @click="toggleTheme"
    >
      <span class="theme-toggle__track" aria-hidden="true">
        <span class="theme-toggle__thumb">
          <span class="theme-toggle__icon">
            <SiteIcon name="sun" class="theme-toggle__sun" />
            <SiteIcon name="moon" class="theme-toggle__moon" />
          </span>
        </span>
      </span>
    </button>

    <a
      class="nav-github"
      href="https://github.com/Qrzzzz"
      target="_blank"
      rel="noreferrer noopener"
      aria-label="View Qrzzzz on GitHub (opens in a new window)"
      title="GitHub"
    >
      <SiteIcon name="github" />
    </a>
  </div>
</template>

<style scoped>
.NavActions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--site-line);
}

.theme-toggle,
.nav-github {
  position: relative;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  box-shadow: none;
  color: var(--site-text-muted);
  transition: background-color 160ms ease, color 160ms ease;
}

.theme-toggle:hover,
.theme-toggle:focus-visible,
.nav-github:hover,
.nav-github:focus-visible {
  background: var(--site-accent-soft);
  color: var(--site-accent-hover);
}

.nav-github::after {
  display: none;
  content: none;
}

.theme-toggle {
  display: grid;
  flex: 0 0 44px;
  place-items: center;
  padding: 0;
  cursor: pointer;
}

.theme-toggle__track, .theme-toggle__thumb, .theme-toggle__icon {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
}
.theme-toggle__icon .site-icon {
  grid-area: 1 / 1;
  width: 20px;
  height: 20px;
  transform-origin: center;
  transition: opacity 240ms ease, transform 360ms cubic-bezier(.22, 1, .36, 1);
}
.theme-toggle__sun { opacity: 1; transform: rotate(0) scale(1); }
.theme-toggle__moon { opacity: 0; transform: rotate(-80deg) scale(.55); }
:global(.dark .theme-toggle__sun) { opacity: 0; transform: rotate(80deg) scale(.55); }
:global(.dark .theme-toggle__moon) { opacity: 1; transform: rotate(0) scale(1); }

.nav-github {
  display: inline-flex;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  padding: 0;
  text-decoration: none;
}

.nav-github > .site-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;

}

@media (max-width: 767.98px) {
  .NavActions {
    gap: 2px;
    margin-left: 6px;
    padding-left: 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .theme-toggle__track,
  .theme-toggle__thumb,
  .theme-toggle__icon .site-icon,
  .theme-toggle,
  .nav-github {
    transition: none;
  }
}
</style>
