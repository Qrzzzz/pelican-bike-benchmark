import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewCache } from "../site/assets/preview-cache.js";

test("preview cache shares pending reads, reuses parsed content, and reloads explicitly", async () => {
  let calls = 0;
  const cache = createPreviewCache(async (url) => { calls++; return `${url}:${calls}`; });
  const first = cache.get("a");
  assert.equal(cache.get("a"), first);
  assert.equal(await first, "a:1");
  assert.equal(await cache.get("a"), "a:1");
  cache.clear();
  assert.equal(await cache.get("a"), "a:2");
});
test("failed preview reads can retry and retention is bounded", async () => {
  let calls = 0;
  const cache = createPreviewCache(async () => { if (++calls === 1) throw new Error("offline"); return calls; }, 2);
  await assert.rejects(cache.get("a"), /offline/);
  assert.equal(await cache.get("a"), 2);
  await cache.get("b");
  await cache.get("c");
  assert.equal(await cache.get("a"), 5);
});
