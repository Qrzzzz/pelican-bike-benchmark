<script setup>
import { onMounted, onBeforeUnmount, watch, nextTick, computed } from "vue";
import { useData, useRouter } from "vitepress";
import DefaultTheme from "vitepress/theme";
import NavActions from "../vendor/NavActions.vue";
import InlineSearch from "../vendor/InlineSearch.vue";
import BackToTop from "../vendor/BackToTop.vue";
import SiteLoading from "../vendor/SiteLoading.vue";
import { createNavigationAccessibility } from "../vendor/navigationAccessibility";
import { createTopNavigationMarker } from "../vendor/topNavigationMarker";
const { Layout } = DefaultTheme;
const { frontmatter, isDark } = useData();
const router = useRouter(),
  previousBefore = router.onBeforeRouteChange;
const kind = computed(() => frontmatter.value.pageType || "document");
const navigation = createNavigationAccessibility(),
  marker = createTopNavigationMarker();
// Preserve this site's document navigation and controller lifetime. Hashes
// stay native; a different document gets a fresh business-controller instance.
function navigate(event) {
  const anchor = event.target.closest?.("a[href]");
  if (
    !anchor ||
    event.defaultPrevented ||
    event.button ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    anchor.target ||
    anchor.hasAttribute("download")
  )
    return;
  const url = new URL(anchor.href, location.href);
  if (
    url.origin === location.origin &&
    (url.pathname !== location.pathname || url.search !== location.search)
  ) {
    event.preventDefault();
    event.stopPropagation();
    location.assign(url.href);
  }
}
function syncTheme() {
  document.documentElement.dataset.theme = isDark.value ? "dark" : "light";
}
onMounted(() => {
  syncTheme();
  navigation.mount();
  marker.mount();
  document.addEventListener("click", navigate, true);
  router.onBeforeRouteChange = async (to) => {
    const url = new URL(to, location.href);
    if (url.pathname !== location.pathname || url.search !== location.search) {
      location.assign(url.href);
      return false;
    }
    return previousBefore?.(to);
  };
  const github = document.querySelector(".nav-github");
  if (github) {
    github.href = "https://github.com/Qrzzzz/pelican-bike-benchmark";
    github.setAttribute("aria-label", "GitHub 仓库（在新窗口打开）");
  }
});
watch(isDark, syncTheme);
onBeforeUnmount(() => {
  navigation.destroy();
  marker.destroy();
  document.removeEventListener("click", navigate, true);
  router.onBeforeRouteChange = previousBefore;
});
</script>
<template>
  <div class="site-layout" :data-page-kind="kind">
    <SiteLoading /><Layout
      ><template #nav-bar-content-before><InlineSearch /></template
      ><template #nav-bar-content-after><NavActions /></template
      ><template #doc-bottom><BackToTop /></template
    ></Layout>
  </div>
</template>
