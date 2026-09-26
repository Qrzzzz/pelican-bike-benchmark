import test from "node:test";
import assert from "node:assert/strict";
import { galleryReturn, galleryPosition } from "../site/assets/gallery-state.js";

const current = "https://example.com/pelican-bike-benchmark/entry.html?id=one";
const fallback = "https://example.com/pelican-bike-benchmark/index.html#gallery";
test("gallery return preserves filters and a work anchor inside the deployment", () => {
  const url = galleryReturn("index.html?q=GPT&provider=OpenAI&model=GPT-6&effort=high&kind=benchmark#work-one", current);
  assert.equal(url.searchParams.get("q"), "GPT");
  assert.equal(url.searchParams.get("provider"), "OpenAI");
  assert.equal(url.searchParams.get("model"), "GPT-6");
  assert.equal(url.searchParams.get("effort"), "high");
  assert.equal(url.searchParams.get("kind"), "benchmark");
  assert.equal(url.hash, "#work-one");
});
test("gallery return rejects external, executable and unrelated local targets", () => {
  for (const value of [null, "https://evil.test/index.html", "//evil.test/index.html", "javascript:alert(1)",
    "https://user:pass@example.com/pelican-bike-benchmark/index.html", "../index.html", "compare.html", "https://example.com:8443/pelican-bike-benchmark/index.html"]) {
    assert.equal(galleryReturn(value, current).href, fallback, String(value));
  }
  assert.equal(galleryReturn("index.html?untrusted=1#wrong", current).href, fallback);
});
test("saved position only applies to the exact gallery URL and valid coordinates", () => {
  const value = {url:fallback, y:1234, anchor:"work-one"};
  assert.deepEqual(galleryPosition(value,fallback),value);
  for (const invalid of [null, {...value,url:"other"}, {...value,y:-1}, {...value,y:Infinity}, {...value,anchor:"arbitrary"}]) {
    assert.equal(galleryPosition(invalid,fallback),null);
  }
});
