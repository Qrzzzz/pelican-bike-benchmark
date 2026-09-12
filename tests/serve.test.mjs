import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreviewServer } from "../scripts/serve.mjs";

test("preview serves Pages paths, conditional GET, HEAD, and rejects invalid requests", async (t) => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = await fetch(base + "/pelican-bike-benchmark/");
  assert.equal(get.status, 200);
  assert.match(await get.text(), /鹈鹕骑车/);
  const head = await fetch(base + "/index.html", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("content-length"), get.headers.get("content-length"));
  const cached = await fetch(base + "/index.html", { headers: { "If-None-Match": get.headers.get("etag") } });
  assert.equal(cached.status, 304);
  const redirect = await fetch(base + "/pelican-bike-benchmark?q=bird", { redirect: "manual" });
  assert.equal(redirect.headers.get("location"), "/pelican-bike-benchmark/?q=bird");
  for (const path of ["/%", "/%00", "/%5c..%5cpackage.json", "/C:secret"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 400, path);
    await response.text();
  }
  for (const path of ["/package.json", "/data/", "/%2e%2e%2fpackage.json"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404, path);
    await response.text();
  }
  const post = await fetch(base + "/index.html", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
  await post.text();
  const final = await fetch(base + "/index.html");
  assert.equal(final.status, 200);
  await final.text();
});
