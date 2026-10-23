import { defineConfig } from "vitepress";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareLoadingHtml } from "../../scripts/loading.mjs";
import { searchAssets } from "./searchAssets";
import { tokenizeSearch } from "./content/search.mjs";
export default defineConfig({
  title: "鹈鹕骑车",
  description: "同一道提示词，观察不同模型的鹈鹕骑车作品。",
  lang: "zh-CN",
  base: "/pelican-bike-benchmark/",
  srcExclude: ["generated/**"],
  cacheDir: "../output/vitepress-cache",
  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/pelican-bike-benchmark/favicon.svg",
      },
    ],
  ],
  appearance: { initialValue: "auto", valueDark: "dark", valueLight: "light" },
  vite: {
    plugins: [searchAssets()],
    ssr: { noExternal: ["minisearch"] },
    build: { chunkSizeWarningLimit: 1000 },
  },
  themeConfig: {
    nav: [
      { text: "作品陈列室", link: "/" },
      { text: "并排对比", link: "/compare" },
      { text: "测试方法", link: "/method" },
    ],
    outline: { label: "本页导航", level: [2, 3] },
    search: {
      provider: "local",
      options: {
        miniSearch: {
          options: {
            tokenize: tokenizeSearch,
            storeFields: ["title", "titles", "text"],
          },
        },
        _render(src, env, md) {
          md.render(src, env);
          const page =
            {
              作品陈列室: "index",
              测试方法: "method",
              作品详情: "entry",
              并排对比: "compare",
            }[env.frontmatter?.title] || "index";
          const pages = JSON.parse(
            readFileSync("frontend/generated/pages.json", "utf8"),
          );
          return `<h1>${md.utils.escapeHtml(env.frontmatter?.title || "鹈鹕骑车")}<a href="#"></a></h1>${(pages[page] || "").replace(/<script\b[\s\S]*?<\/script>/g, "")}`;
        },
      },
    },
    footer: {
      message: "一只鹈鹕，一辆自行车，无数种可能。",
      copyright: "鹈鹕骑车 · Pelican Bike Benchmark",
    },
  },
  transformPageData(data) {
    if (data.relativePath === "method.md")
      data.headers = JSON.parse(
        readFileSync(resolve("frontend/generated/headers.json"), "utf8"),
      );
  },
  transformHtml(html) {
    // VitePress owns the theme; critical tokens use the same .dark selector.
    const tokens = readFileSync(
      resolve("frontend/.vitepress/vendor/styles/tokens.css"),
      "utf8",
    ).replace(/\.dark\s*\{/g, ':root[data-theme="dark"] {');
    const theme = `<script id="sync-initial-theme-color">(()=>{let saved;try{saved=localStorage.getItem('vitepress-theme-appearance')}catch{}const dark=saved==='dark'||(saved!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.classList.toggle('dark',dark)})();</script>`;
    const css = readFileSync(
      "frontend/.vitepress/vendor/SiteLoading.vue",
      "utf8",
    )
      .match(/<style scoped>([\s\S]*?)<\/style>/)![1]
      .replace(/:global\(([^)]+)\)/g, "$1");
    return prepareLoadingHtml(html.replace("</head>", theme + "</head>"), {
      markup: "",
      css,
      tokens,
    });
  },
});
