import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { build } from "esbuild";
import { renderGallery } from "../site/assets/gallery-render.js";

const inlineJson = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
export async function buildSite({ source = resolve("site"), output = resolve("dist") } = {}) {
  if (output === source || output.startsWith(source + "/") || output.startsWith(source + "\\")) throw new Error("Build output must be outside site");
  await mkdir(output, { recursive: true });
  await cp(source, output, { recursive: true });
  const entries = JSON.parse(await readFile(join(source, "data/submissions.json"), "utf8"));
  const prompt = JSON.parse(await readFile(join(source, "data/prompt.v2.json"), "utf8"));
  const gallery = [];
  for (const entry of entries) {
    const { id, kind, title, description, modelProvider, model, version, parameters, cover, staticCheck } = entry;
    const item = { id, kind, title, description, modelProvider, model, version, parameters: { reasoningEffort: parameters?.reasoningEffort }, cover, staticCheck: { passed: staticCheck.passed } };
    if (cover && /\.(png|webp)$/.test(cover)) {
      item.thumbnail = "thumbnail.webp";
      await sharp(join(source, "submissions", id, cover)).resize({ width: 600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(output, "submissions", id, item.thumbnail));
    }
    gallery.push(item);
  }
  await build({ entryPoints: [join(source, "assets/app.js")], outfile: join(output, "assets/app.js"), bundle: true, format: "esm", minify: true, target: "es2022" });
  const theme = await readFile(join(source, "assets/theme.js"), "utf8");
  const formal = gallery.filter((s) => s.kind !== "demo").length;
  for (const page of ["index", "compare", "entry", "method"]) {
    let html = await readFile(join(source, page + ".html"), "utf8");
    html = html.replace('<script src="assets/theme.js"></script>', `<script>${theme}</script>`);
    const preload = ["compare", "entry"].includes(page) ? '<link rel="preload" href="data/submissions.json" as="fetch" crossorigin="anonymous">' : "";
    html = html.replace('<script type="module" src="assets/app.js"></script>', `${preload}\n    <script type="module" src="assets/app.js"></script>`);
    let data = `<script type="application/json" id="initial-prompt">${inlineJson(prompt)}</script>`;
    if (page === "index") {
      html = html.replace('<div class="catalog" id="cards"></div>', `<div class="catalog" id="cards" data-prerendered>${renderGallery(gallery)}</div>`)
        .replace("正在读取作品…", `${gallery.length} 个作品 · ${formal} 个正式测试`)
        .replace("正在加载正式投稿。", formal ? `当前收录 ${formal} 个正式测试。所有作品保留原始输出，未评分项不参与排名。` : "目前尚无正式参测结果。")
        .replace("请启用 JavaScript 以浏览作品、复制提示词或进行对比。", "作品可直接浏览；请启用 JavaScript 以筛选作品、复制提示词或进行对比。");
      data += `<script type="application/json" id="initial-gallery">${inlineJson(gallery)}</script>`;
    }
    html = html.replace("</body>", `${data}\n  </body>`);
    await writeFile(join(output, page + ".html"), html);
  }
  return { entries: gallery.length, output };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildSite();
  console.log(`Built ${result.entries} works into ${result.output}`);
}
