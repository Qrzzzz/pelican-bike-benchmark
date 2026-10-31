import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "parse5";
import sharp from "sharp";
import { buildSite } from "../scripts/build.mjs";
import { renderGallery } from "../site/assets/gallery-render.js";

test("build provides complete cards without JavaScript and preserves original evidence", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "pelican-build-test-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const entries = JSON.parse(await readFile("site/data/submissions.json", "utf8"));
  await buildSite({ output });
  const searchIndex=JSON.parse(await readFile(join(output,'search-index/root.json'),'utf8'));
  const searchTitles=Object.values(searchIndex.storedFields).map(field=>field.title);
  assert(searchTitles.includes('测试方法') && searchTitles.includes('作品陈列室'),'shared search indexes actual business page titles');
  const html = await readFile(join(output, "index.html"), "utf8");
  const nodes = [];
  function walk(node) { nodes.push(node); for (const child of node.childNodes || []) walk(child); }
  walk(parse(html));
  const attrs = (node) => Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
  const cards = nodes.filter(n => attrs(n).class === "card");
  assert.equal(cards.length, entries.length);
  const embedded = nodes.find(n => attrs(n).id === "initial-gallery");
  const gallery = JSON.parse(embedded.childNodes[0].value);
  assert.equal(gallery.length, entries.length);
  assert(!html.includes("正在读取作品"));
  assert(!html.includes('src="assets/theme.js"'));
  assert(html.includes('VPNav') && html.includes('site-layout'), 'shared Vue/VitePress shell is SSR rendered');
  const first = entries.find(e => /\.(png|webp)$/.test(e.cover || ""));
  const original = await readFile(`site/submissions/${first.id}/${first.cover}`);
  assert.deepEqual(await readFile(join(output, "submissions", first.id, first.cover)), original);
  assert.deepEqual(await readFile(join(output, "submissions", first.id, "source.html.txt")), await readFile(`site/submissions/${first.id}/source.html.txt`));
  const thumbnail = join(output, "submissions", first.id, "thumbnail.webp");
  assert.equal((await sharp(await readFile(thumbnail)).metadata()).width, 600);
  assert((await stat(thumbnail)).size < original.length);
  for (const page of ['index', 'method', 'compare', 'entry']) {
    const built = await readFile(join(output, `${page}.html`), 'utf8');
    assert(built.indexOf('<meta charset=') < built.indexOf('site-loading-critical'), 'charset stays first');
    assert(built.indexOf('site-loading-bootstrap') < built.search(/<link[^>]*rel="[^"]*stylesheet/), 'boot precedes resource loading');
    assert(built.includes('site-loading--boot'), `${page} shares the original loader`);
    assert(built.includes('data-site-boot-style media="print"'), 'main styles do not block the loader');
    assert(/<noscript><link[^>]*rel="[^"]*stylesheet/.test(built), 'no-JS keeps regular stylesheet loading');
    assert(built.includes(':root[data-theme="dark"]{--site-canvas: #151d37;'), 'critical loader follows the existing dark theme');
    assert(built.includes('pelican-business'), 'business data mounts inside the shared theme');
  }
});

test("gallery escapes submitted text and keeps return filters", () => {
  const html = renderGallery([{ id: "safe-id", model: "<script>", title: '"<img>', description: "<script>alert(1)</script>", staticCheck: { passed: false } }], { returnUrl: "index.html?q=bike&provider=A" });
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("return=index.html%3Fq%3Dbike%26provider%3DA%23work-safe-id"));
});
