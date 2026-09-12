import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSource, makePreview, sha256 } from "../scripts/lib.mjs";
import { importEntry } from "../scripts/import.mjs";
const prompt = JSON.parse(await readFile("site/data/prompt.v1.json", "utf8"));
const source =
  '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><style>body{color:teal}</style></head><body><h1>Pelican</h1><script>document.body.dataset.ready="true";</script></body></html>';
async function fixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "pelican-import-test-"));
  await mkdir(join(root, "data"));
  await mkdir(join(root, "submissions"));
  await writeFile(join(root, "data/prompt.v1.json"), JSON.stringify(prompt));
  await writeFile(join(root, "data/submissions.json"), "[]");
  const meta = {
    id: "test-run",
    kind: "benchmark",
    title: "测试作品",
    description: "Test",
    model: "Test model",
    version: "test-version",
    generatedAt: "2026-09-12",
    input: prompt.text,
    promptVersion: "v1",
    parameters: { temperature: "未记录" },
    ...overrides,
  };
  const metaPath = join(root, "input-meta.json"),
    sourcePath = join(root, "input-source.txt");
  await writeFile(metaPath, JSON.stringify(meta));
  await writeFile(sourcePath, source);
  return { root, metaPath, sourcePath };
}
test("原始输出字节、输入、哈希与沙盒一致", async () => {
  const f = await fixture();
  const entry = await importEntry(f);
  assert.equal(entry.sourceSha256, sha256(source));
  assert.equal(entry.input, prompt.text);
  assert(entry.staticCheck.passed);
  assert.equal(
    await readFile(
      join(f.root, "submissions/test-run/source.html.txt"),
      "utf8",
    ),
    source,
  );
  assert.equal(
    await readFile(join(f.root, "submissions/test-run/preview.html"), "utf8"),
    makePreview(source, "测试作品"),
  );
});
test("同一 id 不能覆盖原始结果", async () => {
  const f = await fixture();
  await importEntry(f);
  await assert.rejects(importEntry(f), /已存在/);
  assert.equal(
    await readFile(
      join(f.root, "submissions/test-run/source.html.txt"),
      "utf8",
    ),
    source,
  );
});

test("并发导入不会互相覆盖索引，失败后释放锁", async () => {
  const f = await fixture();
  const secondPath = join(f.root, "second-meta.json");
  const second = { ...JSON.parse(await readFile(f.metaPath, "utf8")), id: "second-run" };
  await writeFile(secondPath, JSON.stringify(second));
  const inputs = [f, { ...f, metaPath: secondPath }];
  const results = await Promise.allSettled(inputs.map(importEntry));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(results.find((r) => r.status === "rejected").reason.message, /导入正在进行|已存在/);
  assert.equal(JSON.parse(await readFile(join(f.root, "data/submissions.json"), "utf8")).length, 1);
  assert(!(await readdir(join(f.root, "data"))).includes(".import.lock"));
  await importEntry(inputs[results.findIndex((r) => r.status === "rejected")]);
  assert.deepEqual(JSON.parse(await readFile(join(f.root, "data/submissions.json"), "utf8")).map((s) => s.id).sort(), ["second-run", "test-run"]);
  await assert.rejects(importEntry(f), /已存在/);
  assert(!(await readdir(join(f.root, "data"))).includes(".import.lock"));
});

test("截图尺寸不合约时在写入作品前拒绝", async () => {
  const f = await fixture();
  const desktop = join(f.root, "wrong.png");
  const png = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12);
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  await writeFile(desktop, png);
  await assert.rejects(importEntry({ ...f, desktop }), /截图尺寸/);
  assert.deepEqual(await readdir(join(f.root, "submissions")), []);
  assert.equal(await readFile(join(f.root, "data/submissions.json"), "utf8"), "[]");
});
test("路径穿越被拒绝，索引不变", async () => {
  const f = await fixture({ id: "../outside" });
  await assert.rejects(importEntry(f), /id/);
  assert.deepEqual(
    JSON.parse(await readFile(join(f.root, "data/submissions.json"), "utf8")),
    [],
  );
});
test("不一致的提示词不能混入实验", async () => {
  const f = await fixture({ input: prompt.text + " extra" });
  await assert.rejects(importEntry(f), /固定提示词/);
});
test("失败作品保留原文但没有可执行预览", async () => {
  const f = await fixture();
  const raw = source.replace(
    "<h1>",
    '<script>fetch("https://example.invalid")</script><h1>',
  );
  await writeFile(f.sourcePath, raw);
  const entry = await importEntry(f);
  assert.equal(entry.staticCheck.passed, false);
  assert.equal(
    await readFile(
      join(f.root, "submissions/test-run/source.html.txt"),
      "utf8",
    ),
    raw,
  );
  assert(
    !(await readdir(join(f.root, "submissions/test-run"))).includes(
      "preview.html",
    ),
  );
});
test("危险资源、导航、标签和样式被拒绝", () => {
  for (const hostile of [
    '<img src="https://example.invalid/x">',
    '<svg><image href="https://example.invalid/x"/></svg>',
    '<meta http-equiv="refresh" content="0;url=https://example.invalid">',
    '<iframe srcdoc="x"></iframe>',
    '<form action="https://example.invalid"></form>',
    "<style>body{background:uRl(https://example.invalid)}</style>",
    '<style>@import "x.css";</style>',
    '<a href="javascript:alert(1)">x</a>',
    "<button onclick=\"fetch('https://example.invalid')\">x</button>",
    '<script>window.location="https://example.invalid";</script>',
    '<script>import("https://example.invalid/x.js")</script>',
  ])
    assert.equal(
      checkSource(source.replace("<h1>", hostile + "<h1>")).passed,
      false,
      hostile,
    );
});
test("输出围栏与无依据评分被拒绝", async () => {
  assert(!checkSource("```html\n" + source + "\n```").passed);
  const f = await fixture({
    review: { reviewer: "Someone", date: "2026-09-12", scores: { visual: 10 } },
  });
  await assert.rejects(importEntry(f), /评分/);
});
test("预览不暴露顶层脚本并固定网络策略", () => {
  const html = makePreview(source, '"><script>bad</script>');
  assert(html.includes('sandbox="allow-scripts"'));
  assert(!html.includes("allow-same-origin"));
  assert(html.includes("connect-src &#39;none&#39;"));
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
});
test("忽略伪造的路径和检查报告", async () => {
  const f = await fixture({
    cover: "https://example.invalid/x",
    sourceSha256: "forged",
    staticCheck: { passed: true },
    screenshots: { desktop: "../x.html" },
  });
  const entry = await importEntry(f);
  assert.equal(entry.cover, null);
  assert.deepEqual(entry.screenshots, {});
  assert.equal(entry.sourceSha256, sha256(source));
});
test("演示不能计分，日期必须有效", async () => {
  const demo = await fixture({ kind: "demo", review: { scores: {} } });
  await assert.rejects(importEntry(demo), /演示作品不能计分/);
  const dated = await fixture({ generatedAt: "2026-02-31" });
  await assert.rejects(importEntry(dated), /有效/);
});
test("自包含 SVG 图标与本地片段样式不误判为外链", () => {
  const icon =
    "<link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle r='1'/%3E%3C/svg%3E\">";
  assert(checkSource(source.replace("<style>", icon + "<style>")).passed);
  assert(
    checkSource(source.replace("body{color:teal}", "body{filter:url(#shadow)}"))
      .passed,
  );
  assert(
    !checkSource(
      source.replace(
        "body{color:teal}",
        "body{filter:url(https://example.invalid/a.svg#shadow)}",
      ),
    ).passed,
  );
});
test("允许本地 SVG 动画，拒绝动画修改资源引用", () => {
  assert(
    checkSource(
      source.replace(
        "<h1>",
        '<svg><animateTransform attributeName="transform" type="rotate" from="0" to="360"/></svg><h1>',
      ),
    ).passed,
  );
  assert(
    !checkSource(
      source.replace(
        "<h1>",
        '<svg><animate attributeName="href" values="https://example.invalid"/></svg><h1>',
      ),
    ).passed,
  );
});
