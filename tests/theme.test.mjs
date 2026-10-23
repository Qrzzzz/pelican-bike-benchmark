import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
test("vendored theme matches the pinned source manifest", async () => {
  const manifest = JSON.parse(
    await readFile("frontend/theme-source.json", "utf8"),
  );
  assert.match(manifest.commit, /^[a-f0-9]{40}$/);
  for (const [file, hash] of Object.entries(manifest.files)) {
    const bytes = await readFile(resolve("frontend/.vitepress/vendor", file));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash, file);
  }
});
