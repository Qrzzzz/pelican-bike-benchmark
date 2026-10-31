import type { Plugin } from "vite";
import type { DefaultTheme } from "vitepress/theme";

/** Titleless excerpts still need a heading in VitePress's search-only render. */
export const renderSearchContent: NonNullable<DefaultTheme.LocalSearchOptions["_render"]> = (src, env, md) => {
  const html = md.render(src, env);
  if (env.frontmatter?.search === false) return "";
  if (env.frontmatter?.kind !== "excerpt" || /<h1\b/i.test(html)) return html;
  const title = md.utils.escapeHtml(String(env.frontmatter.preview || env.frontmatter.title || "Excerpt"));
  const anchor = md.utils.escapeHtml(html.match(/<article\b[^>]*\bid="([^"]+)"/i)?.[1] ?? "");
  return `<h1>${title}<a href="#${anchor}"></a></h1>${html}`;
};

/** Reuse VitePress's index as retryable static data, without a second indexer. */
export function searchAssets(): Plugin {
  const indexes = new Map<string, string>();
  return {
    name: "site-search-assets",
    apply: (_config, env) => env.command === "build" && !env.isSsrBuild,
    buildStart() { indexes.clear(); },
    transform(code, id) {
      if (!id.startsWith("/@localSearchIndex")) return;
      const locale = id.slice("/@localSearchIndex".length);
      if (!/^[a-zA-Z0-9_-]+$/.test(locale)) return;
      const serialized = JSON.parse(code.replace(/^export default\s+/, "").trim().replace(/;$/, ""));
      const index = JSON.parse(serialized);
      if (!Number.isInteger(index.documentCount) || !index.fieldIds) {
        throw new Error(`Invalid VitePress search index: ${locale}`);
      }
      indexes.set(locale, serialized);
    },
    generateBundle() {
      if (!indexes.size) throw new Error("No searchable site index was generated");
      for (const [locale, source] of indexes) {
        this.emitFile({ type: "asset", fileName: `search-index/${locale}.json`, source });
      }
    }
  };
}
