<script setup lang="ts">
import SiteIcon from "./SiteIcon.vue";
import { tokenizeSearch, rankSearchResults, createSearchLoader, searchExcerpt, highlightSearch, searchPhrases } from "../content/search.mjs";
import localSearchIndex from "@localSearchIndex";
import MiniSearch from "minisearch";
import type { SearchResult } from "minisearch";
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useData, useRouter, withBase } from "vitepress";
import {
  isSearchShortcut,
  moveSearchSelection,
  resolveSearchTargetIndex
} from "./inlineSearchRuntime.mjs";

type SearchDocument = {
  title: string;
  titles: string[];
  text?: string;
};

type InlineSearchResult = SearchResult & SearchDocument;

const root = ref<HTMLElement>();
const panelHeight = ref(430);
const surfaceWidth = ref(44);
const surfaceY = ref(0);
const surfaceRight = ref(0);
const compact = ref(false);
const trigger = ref<HTMLButtonElement>();
const input = ref<HTMLInputElement>();
const expanded = ref(false);
const query = ref("");
const selectedIndex = ref(-1);
const loading = ref(false);
const loadError = ref(false);
const cachedLoad = createSearchLoader();
let loadGeneration = 0;
const searchIndex = shallowRef<MiniSearch<SearchDocument>>();
const { localeIndex, theme } = useData();
const router = useRouter();

const results = computed<InlineSearchResult[]>(() => {
  const value = query.value.trim();
  if (!value || !searchIndex.value) return [];
  const phrases = searchPhrases(value);
  const matches = searchIndex.value.search(value, {
    combineWith: "AND",
    fuzzy: term => /\p{Script=Han}/u.test(term) ? false : 0.2
  }) as InlineSearchResult[];
  return rankSearchResults(matches.filter(result => {
    const content = [result.title, ...(result.titles ?? []), result.text ?? ""].join(" ").normalize("NFKC").toLowerCase();
    return phrases.every(phrase => content.includes(phrase));
  })) as InlineSearchResult[];
});

const activeDescendant = computed(() =>
  selectedIndex.value >= 0 ? `inline-search-item-${selectedIndex.value}` : undefined
);

function isEditingContent(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(
    element?.isContentEditable ||
    element?.matches("input, select, textarea")
  );
}

async function loadIndex() {
  const locale = localeIndex.value;
  const current = ++loadGeneration;
  const loader = localSearchIndex[locale];
  if (!loader) {
    searchIndex.value = undefined;
    loading.value = false;
    loadError.value = true;
    return;
  }

  if (searchIndex.value) return;
  loading.value = true;
  loadError.value = false;
  try {
    const loaded = await cachedLoad(locale, async () => {
      let serialized: string;
      if (import.meta.env.DEV) {
        serialized = (await loader()).default;
      } else {
        const response = await fetch(withBase(`/search-index/${encodeURIComponent(locale)}.json`), {
          cache: "no-cache",
          signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) throw new Error(`Search index HTTP ${response.status}`);
        if (!response.headers.get("content-type")?.includes("json")) {
          throw new Error("The search index response is not JSON");
        }
        serialized = await response.text();
      }
      const options = theme.value.search?.provider === "local"
        ? theme.value.search.options?.miniSearch
        : undefined;
      return markRaw(
        MiniSearch.loadJSON<SearchDocument>(serialized, {
          fields: ["title", "titles", "text"],
          storeFields: ["title", "titles", "text"],
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: { title: 4, text: 2, titles: 1 },
            ...options?.searchOptions
          },
          ...options?.options,
          tokenize: tokenizeSearch
        })
      );
    });
    if (current === loadGeneration) searchIndex.value = loaded;
  } catch (error) {
    console.warn("[site-search] Could not load the search index", error);
    if (current === loadGeneration) loadError.value = true;
  } finally {
    if (current === loadGeneration) loading.value = false;
  }
}

async function openSearch() {
  measureSurface();
  expanded.value = true;
  await nextTick();
  input.value?.focus();
  updateViewport();
  void loadIndex();
}

function measureSurface() {
  if (!root.value) return;
  const anchor = root.value.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const mobile = window.matchMedia("(max-width: 767.98px)").matches;
  compact.value = mobile;
  const nav = root.value.closest(".VPNavBar");
  const title = nav?.querySelector(".VPNavBarTitle")?.getBoundingClientRect();
  const left = Math.max(28, (title?.right ?? 0) + 24);
  // Desktop grows left from the trigger; mobile uses its own row below the navigation.
  surfaceWidth.value = mobile
    ? Math.max(44, (viewport?.width ?? window.innerWidth) - 24)
    : Math.max(44, Math.min(560, anchor.right - left));
  surfaceRight.value = mobile ? anchor.right - ((viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - 12) : 0;
  surfaceY.value = mobile ? Math.max(top + 8, (nav?.getBoundingClientRect().bottom ?? top + 72) + 8) - anchor.top : 0;
  const bottom = anchor.top + surfaceY.value + (mobile ? 48 : 44);
  panelHeight.value = Math.max(0, Math.min(430, top + (viewport?.height ?? window.innerHeight) - bottom - 16));
}

function updateViewport() {
  if (expanded.value) measureSurface();
}

function closeSearch(returnFocus = false) {
  expanded.value = false;
  query.value = "";
  selectedIndex.value = -1;
  if (returnFocus) nextTick(() => trigger.value?.focus());
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (!isSearchShortcut(event, isEditingContent(event.target))) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void openSearch();
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (expanded.value && !root.value?.contains(event.target as Node)) {
    closeSearch();
  }
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    selectedIndex.value = moveSearchSelection(
      selectedIndex.value,
      results.value.length,
      event.key === "ArrowDown" ? 1 : -1
    );
    return;
  }

  if (event.key === "Enter") {
    const index = resolveSearchTargetIndex(selectedIndex.value, results.value.length);
    const target = results.value[index];
    if (!target) return;
    event.preventDefault();
    closeSearch();
    void router.go(target.id);
  }
}

function selectResult(index: number) {
  selectedIndex.value = index;
}

function resultContext(result: InlineSearchResult) {
  return result.titles?.filter(Boolean).join(" / ") ?? "";
}

function clearQuery() {
  query.value = "";
  selectedIndex.value = -1;
  nextTick(() => input.value?.focus());
}

watch(query, () => {
  selectedIndex.value = -1;
});
watch(selectedIndex, () => nextTick(() => {
  if (selectedIndex.value < 0) return;
  document.getElementById(`inline-search-item-${selectedIndex.value}`)?.scrollIntoView({ block: "nearest" });
}));
watch(localeIndex, () => {
  loadGeneration++;
  searchIndex.value = undefined;
  if (expanded.value) void loadIndex();
});
watch(
  () => router.route.path,
  () => closeSearch()
);

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown, true);
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  window.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("scroll", updateViewport);
});

onBeforeUnmount(() => {
  loadGeneration++;
  window.removeEventListener("keydown", handleGlobalKeydown, true);
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  window.removeEventListener("resize", updateViewport);
  window.visualViewport?.removeEventListener("resize", updateViewport);
  window.visualViewport?.removeEventListener("scroll", updateViewport);
});
</script>

<template>
  <div ref="root" class="InlineSiteSearch" :class="{ 'is-expanded': expanded }"
    @keydown.esc.prevent.stop="closeSearch(true)"
    :style="{ '--search-panel-height': `${panelHeight}px`, '--search-width': `${surfaceWidth}px`, '--search-y': `${surfaceY}px`, '--search-right': `${surfaceRight}px` }">
    <button
      ref="trigger"
      type="button"
      class="inline-search-trigger"
      aria-label="Search the site"
      aria-haspopup="listbox"
      :aria-expanded="expanded"
      :tabindex="expanded ? -1 : 0"
      :inert="expanded"
      @click="openSearch"
    >
      <SiteIcon name="search" />
      <span class="inline-search-placeholder">Search the site…</span>
      <kbd>Ctrl K</kbd>
    </button>

    <div class="inline-search-surface" :inert="!expanded">
      <form class="inline-search-form" role="search" @submit.prevent="">
        <SiteIcon name="search" />
        <label class="visually-hidden" for="inline-site-search-input">Search the site</label>
        <input
          id="inline-site-search-input"
          ref="input"
          v-model="query"
          type="search"
          role="combobox"
          aria-label="Search the site"
          aria-autocomplete="list"
          :aria-controls="query && results.length ? 'inline-search-results' : undefined"
          :aria-expanded="Boolean(query && results.length && !loading && !loadError)"
          :aria-activedescendant="activeDescendant"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          enterkeyhint="go"
          maxlength="64"
          :placeholder="compact ? 'Search this site…' : 'Search titles and page content…'"
          spellcheck="false"
          @keydown="handleInputKeydown"
        />
        <button
          v-if="query"
          type="button"
          class="inline-search-action"
          aria-label="Clear search"
          @click="clearQuery"
        >
          <SiteIcon name="delete" />
        </button>
        <button
          type="button"
          class="inline-search-action inline-search-close"
          aria-label="Close search"
          aria-describedby="inline-search-close-tip"
          @click="closeSearch(true)"
        >
          <kbd>Esc</kbd>
          <SiteIcon name="x" class="inline-search-close-icon" />
          <span id="inline-search-close-tip" class="inline-search-tooltip" role="tooltip">Close search</span>
        </button>
      </form>

      <Transition name="search-panel">
      <div v-if="expanded && (query || loading || loadError)" class="inline-search-panel" :inert="!expanded">
        <p v-if="loading" class="inline-search-state" role="status">Loading search index…</p>
        <p v-else-if="loadError" class="inline-search-state" role="alert">
          <span>Search could not load. Please try again.</span>
          <button type="button" @click="loadIndex">Retry search</button>
        </p>
        <ul
          v-else-if="results.length"
          id="inline-search-results"
          role="listbox"
          aria-label="Search results"
        >
          <li
            v-for="(result, index) in results"
            :id="`inline-search-item-${index}`"
            :key="result.id"
            role="option"
            :aria-selected="selectedIndex === index"
          >
            <a
              :href="result.id"
              class="inline-search-result"
              :class="{ 'is-selected': selectedIndex === index }"
              @focus="selectResult(index)"
              @mouseenter="selectResult(index)"
              @click="closeSearch()"
            >
              <strong><template v-for="(part, partIndex) in highlightSearch(result.title, query)" :key="partIndex"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></strong>
              <span v-if="resultContext(result)" class="inline-search-context">{{ resultContext(result) }}</span>
              <span v-if="result.text" class="inline-search-excerpt"><template v-for="(part, partIndex) in highlightSearch(searchExcerpt(result.text, query), query)" :key="partIndex"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span>
            </a>
          </li>
        </ul>
        <p v-else class="inline-search-state" role="status">No results for “{{ query }}”</p>
      </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.InlineSiteSearch {
  position: relative;
  z-index: 12;
  display: flex;
  width: 44px;
  flex: 0 0 44px;
  min-width: 0;
  height: 44px;
}

.inline-search-surface {
  position: absolute;
  top: 0;
  right: 0;
  width: 44px;
  transform: translateY(0);
  pointer-events: none;
  transition: width 420ms cubic-bezier(.22, 1, .36, 1), transform 420ms cubic-bezier(.22, 1, .36, 1);
}

.InlineSiteSearch.is-expanded { z-index: 80; }
.InlineSiteSearch.is-expanded .inline-search-surface {
  width: var(--search-width);
  transform: translateY(var(--search-y));
  pointer-events: auto;
}

.inline-search-trigger,
.inline-search-form {
  position: relative;
  width: 100%;
  height: 44px;
  border: 1px solid var(--site-line);
  border-radius: 3px;
  background: var(--site-surface-subtle);
  color: var(--site-text-muted);
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

.inline-search-trigger {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: opacity 160ms ease 220ms, visibility 0s;
  border: 0;
  background: transparent;
  text-align: left;
}

.InlineSiteSearch.is-expanded .inline-search-trigger {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 100ms ease, visibility 0s linear 100ms;
}

.inline-search-trigger::after,
.inline-search-form::after {
  display: none;
  content: none;
}

.inline-search-trigger:hover,
.inline-search-trigger:focus-visible {
  border-color: var(--site-line-strong);
  background: var(--site-surface);
  color: var(--site-text);
}

.inline-search-trigger .site-icon,
.inline-search-form > .site-icon {
  width: 19px;
  height: 19px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.inline-search-placeholder {
  display: none;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-search-trigger kbd {
  display: none;
  flex: 0 0 auto;
  padding: 2px 5px;
  border: 1px solid var(--site-line);
  border-radius: 5px;
  background: var(--site-surface);
  color: var(--site-text-faint);
  font-family: var(--site-font-sans);
  font-size: 11px;
}

.inline-search-form {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  overflow: hidden;
  border-color: transparent;
  background: var(--site-canvas);
  box-shadow: none;
  visibility: hidden;
  transition: border-color 240ms ease, visibility 0s linear 420ms;
}

.InlineSiteSearch.is-expanded .inline-search-form {
  visibility: visible;
  overflow: visible;
  border-color: var(--site-line-strong);
  transition: border-color 240ms ease, visibility 0s;
}

.inline-search-form > .site-icon {
  box-sizing: content-box;
  width: 19px;
  height: 19px;
  margin-inline: 12px;
  opacity: 1;
}

.inline-search-form > :is(input, .inline-search-action) {
  opacity: 0;
  transition: opacity 100ms ease;
}

.InlineSiteSearch.is-expanded .inline-search-form > :is(input, .inline-search-action) {
  opacity: 1;
  transition: opacity 220ms ease 90ms;
}

.inline-search-form input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--site-text);
  font: inherit;
  font-size: 16px;
}

.inline-search-form input::-webkit-search-cancel-button {
  display: none;
}

.inline-search-form input::placeholder {
  color: var(--site-text-faint);
}

.inline-search-action {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  min-width: 44px;
  height: 40px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--site-text-muted);
  font-size: 17px;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;
}

.inline-search-action:hover,
.inline-search-action:focus-visible {
  background: var(--site-surface-subtle);
  color: var(--site-text);
}

.inline-search-close {
  position: relative;
  min-width: 36px;
  height: 30px;
  margin-inline: 2px 6px;
  padding: 0 6px;
  border: 1px solid transparent;
  font-family: var(--site-font-sans);
  font-size: 11px;
  line-height: 1;
}
.inline-search-close kbd { font: inherit; }
.inline-search-close-icon { display: none; }
.inline-search-close:hover,
.inline-search-close:focus-visible { border-color: var(--site-line); background: var(--site-accent-soft); color: var(--site-link); }
.inline-search-tooltip {
  position: absolute;
  z-index: 2;
  top: calc(100% + 12px);
  right: -1px;
  padding: 7px 9px;
  border: 1px solid var(--site-line);
  border-radius: 3px;
  background: var(--site-canvas);
  color: var(--site-text-muted);
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 120ms ease, visibility 0s linear 120ms;
}
.inline-search-close:focus-visible .inline-search-tooltip { opacity: 1; visibility: visible; transition-delay: 0s; }
@media (hover: hover) {
  .inline-search-close:hover .inline-search-tooltip { opacity: 1; visibility: visible; transition-delay: 220ms; }
}

.inline-search-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  max-height: min(var(--search-panel-height, 430px), calc(100dvh - 76px));
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding-block: 6px;
  border: 1px solid var(--site-line);
  border-radius: 3px;
  padding: 4px;
  background: var(--site-surface);
  box-shadow: 0 14px 32px color-mix(in srgb, var(--site-canvas) 70%, transparent);
}

.inline-search-panel ul {
  margin: 0;
  padding: 6px;
  list-style: none;
}

.inline-search-result {
  display: flex;
  min-height: 54px;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 12px;
  border-radius: 2px;
  color: var(--site-text);
  text-decoration: none;
}

.inline-search-result:hover,
.inline-search-result.is-selected {
  background: var(--site-surface-subtle);
}

.inline-search-result strong {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-family: var(--site-font-reading);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
}

.inline-search-context {
  overflow: hidden;
  color: var(--site-text-faint);
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inline-search-excerpt {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: var(--site-text-muted);
  font-size: 12px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.inline-search-result mark { padding: 0; border-radius: 0; background: var(--site-accent-soft); color: var(--site-link); }

.inline-search-state {
  margin: 0;
  padding: 18px;
  color: var(--site-text-muted);
  font-size: 13px;
  text-align: center;
}
.inline-search-state[role="alert"] { display: grid; justify-items: center; gap: 8px; }
.inline-search-state button { min-height: 32px; padding: 4px 10px; border: 1px solid var(--site-line); border-radius: 3px; color: var(--site-link); cursor: pointer; }
.inline-search-state button:hover, .inline-search-state button:focus-visible { background: var(--site-accent-soft); border-color: var(--site-link); }

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Mobile geometry is measured from the same icon, including the visible keyboard viewport. */
@media (max-width: 767.98px) {
  .inline-search-surface { max-width: calc(100vw - 24px); }
  .InlineSiteSearch.is-expanded .inline-search-surface { right: var(--search-right); }
  .inline-search-form { height: 48px; border-radius: 7px; }
  .inline-search-form input { font-size: 16px; line-height: 1.4; }
  .inline-search-close { width: 44px; min-width: 44px; height: 44px; margin: 0 2px 0 0; padding: 0; }
  .inline-search-close kbd { display: none; }
  .inline-search-close-icon { display: block; width: 20px; height: 20px; }
  .inline-search-tooltip { display: none; }
  .inline-search-panel { border-radius: 7px; }
  .inline-search-result { padding: 12px 10px; }
  .inline-search-result strong { font-size: 17px; }
  .inline-search-excerpt { font-size: 13px; }
}

.search-panel-enter-active { transition: opacity 180ms ease 120ms, transform 240ms cubic-bezier(.22, 1, .36, 1) 120ms; }
.search-panel-leave-active { transition: opacity 100ms ease; }
.search-panel-enter-from { opacity: 0; transform: translateY(-5px); }
.search-panel-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .InlineSiteSearch *, .search-panel-enter-active, .search-panel-leave-active {
    transition: none !important;
  }
}
</style>
