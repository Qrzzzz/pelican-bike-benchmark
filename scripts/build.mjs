import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { build as buildVitepress } from "vitepress";
import { renderGallery } from "../site/assets/gallery-render.js";

const inlineJson = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
export async function buildSite({
  source = resolve("site"),
  output = resolve("dist"),
} = {}) {
  if (
    output === source ||
    output.startsWith(source + "/") ||
    output.startsWith(source + "\\")
  )
    throw new Error("Build output must be outside site");
  await mkdir(output, { recursive: true });
  await mkdir("frontend/generated", { recursive: true });
  await mkdir("frontend/public", { recursive: true });
  await cp(join(source, "data"), "frontend/public/data", { recursive: true });
  await cp(join(source, "submissions"), "frontend/public/submissions", {
    recursive: true,
  });
  const pages = {};
  const headers = [];
  const entries = JSON.parse(
    await readFile(join(source, "data/submissions.json"), "utf8"),
  );
  const prompt = JSON.parse(
    await readFile(join(source, "data/prompt.v2.json"), "utf8"),
  );
  const gallery = [];
  for (const entry of entries) {
    const {
      id,
      kind,
      title,
      description,
      modelProvider,
      model,
      version,
      parameters,
      cover,
      staticCheck,
    } = entry;
    const item = {
      id,
      kind,
      title,
      description,
      modelProvider,
      model,
      version,
      parameters: { reasoningEffort: parameters?.reasoningEffort },
      cover,
      staticCheck: { passed: staticCheck.passed },
    };
    if (cover && /\.(png|webp)$/.test(cover)) {
      item.thumbnail = "thumbnail.webp";
    }
    gallery.push(item);
  }
  // Preserve the domain templates as build-owned Vue islands. The VitePress
  // theme owns all chrome, typography, search and document navigation.
  const formal = gallery.filter((s) => s.kind !== "demo").length;
  for (const page of ["index", "compare", "entry", "method"]) {
    let html = await readFile(join(source, page + ".html"), "utf8");
    let data = `<script type="application/json" id="initial-prompt">${inlineJson(prompt)}</script>`;
    if (page === "index") {
      html = html
        .replace(
          '<div class="catalog" id="cards"></div>',
          `<div class="catalog" id="cards" data-prerendered>${renderGallery(gallery)}</div>`,
        )
        .replace(
          "正在读取作品…",
          `${gallery.length} 个作品 · ${formal} 个正式测试`,
        )
        .replace(
          "正在加载正式投稿。",
          formal
            ? `当前收录 ${formal} 个正式测试。所有作品保留原始输出，未评分项不参与排名。`
            : "目前尚无正式参测结果。",
        )
        .replace(
          "请启用 JavaScript 以浏览作品、复制提示词或进行对比。",
          "作品可直接浏览；请启用 JavaScript 以筛选作品、复制提示词或进行对比。",
        );
      data += `<script type="application/json" id="initial-gallery">${inlineJson(gallery)}</script>`;
    }
    let main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    if (page === "index")
      main = main.replace(
        /<header class="catalog-header">[\s\S]*?<\/header>/,
        '<div class="catalog-links"><button class="button" data-prompt>查看固定提示词</button></div>',
      );
    if (page === "method")
      main = main.replace(/<h([23])>(.*?)<\/h\1>/g, (match, level, title) => {
        const slug = `${["protocol", "prompt", "rubric", "environment", "contribute", "limitations"][headers.length]}-heading`;
        headers.push({ level: Number(level), title, slug });
        return `<h${level} id="${slug}">${title}</h${level}>`;
      });
    pages[page] =
      `<div id="main">${main}</div>${html.match(/<dialog class="dialog" id="prompt-dialog"[\s\S]*?<\/dialog>/)?.[0] || ""}<div class="toast" id="toast" role="status" hidden></div>${data}`;
    const titles = {
      index: "作品陈列室",
      method: "测试方法",
      entry: "作品详情",
      compare: "并排对比",
    };
    const heading =
      page === "index"
        ? '<CatalogHeader title="作品陈列室" description="同一道鹈鹕骑车提示词，观察不同模型的构图、动画、交互与代码。" />'
        : "";
    await writeFile(
      `frontend/${page}.md`,
      `---\ntitle: ${titles[page]}\npageType: ${page === "method" ? "document" : page === "entry" ? "entry" : "index"}\noutline: ${page === "method" ? "[2, 3]" : "false"}\n---\n${heading}\n<BusinessPage page="${page}" />\n`,
    );
  }
  await writeFile("frontend/generated/pages.json", JSON.stringify(pages));
  await writeFile("frontend/generated/headers.json", JSON.stringify(headers));
  await buildVitepress(resolve("frontend"), { outDir: output });
  // VitePress copies public evidence bytes unchanged; thumbnails are generated
  // in a separate pass because the source captures remain immutable.
  for (const item of gallery)
    if (item.thumbnail)
      await sharp(join(source, "submissions", item.id, item.cover))
        .resize({ width: 600, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(join(output, "submissions", item.id, item.thumbnail));
  return { entries: gallery.length, output };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await buildSite();
  console.log(`Built ${result.entries} works into ${result.output}`);
}
