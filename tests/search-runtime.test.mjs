import test from "node:test";
import assert from "node:assert/strict";
import { searchGeometry, isSearchShortcut, moveSearchSelection, searchTargetIndex } from "../site/assets/search-runtime.js";

test("desktop search expands from its icon within the header", () => {
  const geometry = searchGeometry({ left: 800, top: 16 }, 1200, { left: 0, top: 0, width: 1440, height: 900 }, false);
  assert.deepEqual(geometry, { width: 560, x: -160, y: 0, height: 430 });
  const narrow = searchGeometry({ left: 24, top: 10 }, 350, { left: 0, top: 0, width: 800, height: 400 }, false);
  assert.equal(narrow.x, -234);
  assert.equal(narrow.height, 326);
});
test("mobile geometry respects visual viewport offsets, keyboard and available height", () => {
  const geometry = searchGeometry({ left: 220, top: 150 }, 360, { left: 5, top: 140, width: 320, height: 220 }, true);
  assert.equal(geometry.width, 296);
  assert.equal(220 + geometry.x, 17);
  assert.equal(150 + geometry.y, 150);
  assert.equal(geometry.height, 146);
  assert.equal(searchGeometry({ left: 10, top: 0 }, 300, { left: 0, top: 0, width: 320, height: 40 }, true).height, 0);
});
test("search shortcuts respect editing and keyboard navigation wraps correctly", () => {
  assert(isSearchShortcut({ key: "K", metaKey: true }, true));
  assert(isSearchShortcut({ key: "/" }, false));
  assert(!isSearchShortcut({ key: "/" }, true));
  assert.equal(moveSearchSelection(-1, 3, 1), 0);
  assert.equal(moveSearchSelection(-1, 3, -1), 2);
  assert.equal(moveSearchSelection(2, 3, 1), 0);
  assert.equal(moveSearchSelection(0, 0, -1), -1);
  assert.equal(searchTargetIndex(-1, 3), 0);
  assert.equal(searchTargetIndex(2, 3), 2);
  assert.equal(searchTargetIndex(0, 0), -1);
});
