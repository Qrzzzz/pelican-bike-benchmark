import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { parse } from "parse5";
import { sha256, validateMeta, checkSource, makePreview } from "./lib.mjs";
const root = "site";
const prompt = JSON.parse(
  await readFile(join(root, "data/prompt.v1.json"), "utf8"),
);
assert.equal(prompt.sha256, sha256(prompt.text), "提示词哈希不一致");
const entries = JSON.parse(
  await readFile(join(root, "data/submissions.json"), "utf8"),
);
const ids = new Set();
for (const entry of entries) {
  validateMeta(entry, prompt);
  assert(!ids.has(entry.id), "重复的作品 id");
  ids.add(entry.id);
  const dir = join(root, "submissions", entry.id),
    sourceBytes = await readFile(join(dir, "source.html.txt")),
    source = sourceBytes.toString("utf8");
  assert.equal(
    sha256(sourceBytes),
    entry.sourceSha256,
    `${entry.id} 原始输出哈希不一致`,
  );
  assert.deepEqual(
    JSON.parse(await readFile(join(dir, "meta.json"), "utf8")),
    entry,
    "元数据与索引不一致",
  );
  assert.deepEqual(checkSource(source), entry.staticCheck, "静态检查报告过期");
  if (entry.staticCheck.passed)
    assert.equal(
      await readFile(join(dir, "preview.html"), "utf8"),
      makePreview(source, entry.title),
      "沙盒包装被修改",
    );
  else
    assert(
      !(await readdir(dir)).includes("preview.html"),
      "失效作品不得提供可运行预览",
    );
  for (const file of [
    entry.cover,
    ...Object.values(entry.screenshots || {}),
  ].filter(Boolean)) {
    assert(
      /^(?:cover\.svg|(?:desktop|mobile)\.(?:png|webp))$/.test(file),
      "不安全的图片路径",
    );
    await readFile(join(dir, file));
  }
  for (const [view, file] of Object.entries(entry.screenshots || {})) {
    const bytes = await readFile(join(dir, file));
    assert.equal(
      entry.screenshotSha256?.[view],
      sha256(bytes),
      "截图哈希不一致",
    );
    if (file.endsWith(".png")) {
      assert.equal(
        bytes.readUInt32BE(16),
        view === "desktop" ? 1200 : 390,
        "截图宽度不符合协议",
      );
      assert.equal(
        bytes.readUInt32BE(20),
        view === "desktop" ? 800 : 844,
        "截图高度不符合协议",
      );
    }
  }
}
for (const page of [
  "index.html",
  "compare.html",
  "entry.html",
  "method.html",
]) {
  const html = await readFile(join(root, page), "utf8");
  assert(html.includes('lang="zh-CN"'));
  assert(html.includes("<title>"));
  let main = 0;
  async function walk(node) {
    if (node.tagName === "main") main++;
    for (const a of node.attrs || []) {
      if (
        !["src", "href"].includes(a.name) ||
        !a.value ||
        /^(?:https?:|#)/.test(a.value)
      )
        continue;
      const path = a.value.split(/[?#]/)[0];
      if (path) await readFile(join(root, path));
    }
    for (const child of node.childNodes || []) await walk(child);
  }
  await walk(parse(html));
  assert.equal(main, 1);
}
console.log(
  `站点检查通过：4 个页面，${entries.length} 个作品，提示词与输出哈希、元数据、静态报告、沙盒及静态链接一致。`,
);
