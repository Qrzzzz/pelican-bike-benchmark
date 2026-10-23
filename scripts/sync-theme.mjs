import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: node scripts/sync-theme.mjs <personal-docs repository>",
  );
const theme = join(source, "docs/.vitepress/theme");
const files = [
  "SiteIcon.vue",
  "NavActions.vue",
  "BackToTop.vue",
  "SiteLoading.vue",
  "InlineSearch.vue",
  "inlineSearchRuntime.mjs",
  "themeTransitionRuntime.mjs",
  "loadingPoems.mjs",
  "loadingPoemRuntime.mjs",
  "navigationAccessibility.ts",
  "topNavigationMarker.ts",
  "components/CatalogHeader.vue",
  ...[
    "fonts",
    "tokens",
    "site",
    "content",
    "code",
    "emphasis",
    "catalog",
    "document-layout",
    "icons",
  ].map((n) => `styles/${n}.css`),
];
const manifest = {
  repository: "https://github.com/Qrzzzz/Qrzzzz.github.io",
  commit: execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  files: {},
};
for (const file of [
  ...files,
  "../content/search.mjs",
  "../searchAssets.ts",
  "assets/github-invertocat.svg",
]) {
  const bytes = await readFile(join(theme, file));
  const dest = resolve("frontend/.vitepress/vendor", file);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  manifest.files[file] = createHash("sha256").update(bytes).digest("hex");
}
const fonts = await readFile(join(theme, "styles/fonts.css"), "utf8");
for (const match of fonts.matchAll(/url\("\/fonts\/([^"?]+)"\)/g)) {
  const dest = resolve("frontend/public/fonts", match[1]);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(join(source, "docs/public/fonts", match[1]), dest);
}
await mkdir("frontend/.vitepress/vendor/assets", { recursive: true });
await copyFile(
  join(theme, "assets/github-invertocat.svg"),
  "frontend/.vitepress/vendor/assets/github-invertocat.svg",
);
async function copyLicenses(dir, relative = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = join(relative, entry.name);
    if (entry.isDirectory()) await copyLicenses(join(dir, entry.name), rel);
    else if (/OFL|LICENSE/i.test(entry.name)) {
      const dest = resolve("frontend/public/fonts", rel);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(join(dir, entry.name), dest);
    }
  }
}
await copyLicenses(join(source, "docs/public/fonts"));
await writeFile(
  "frontend/theme-source.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`Pinned ${files.length} theme files at ${manifest.commit}`);
