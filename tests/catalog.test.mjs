import test from "node:test";
import assert from "node:assert/strict";
import { cascade, groupCatalog, identityOf, compareEfforts } from "../site/assets/catalog.js";
const entry = (modelProvider, model, reasoningEffort) => ({ modelProvider, model, parameters: { reasoningEffort }, kind: "benchmark" });
const items = [entry("A", "Shared", "high"), entry("A", "Shared", "low"), entry("B", "Shared", "max"), entry("B", "Other", "default")];
test("cascade scopes same-named models to provider and clears invalid descendants", () => {
  const state = cascade(items, { provider: "A", model: "Other", effort: "default" });
  assert.deepEqual(state.models, ["Shared"]);
  assert.equal(state.model, "");
  assert.equal(state.effort, "");
  assert.deepEqual(state.efforts, ["low", "high"]);
  assert.deepEqual(cascade(items, { provider: "B", model: "Shared", effort: "max" }).efforts, ["max"]);
  assert.equal(cascade(items, { provider: "missing", model: "missing", effort: "missing" }).provider, "");
});
test("groups preserve provider boundaries and raw effort values", () => {
  const groups = groupCatalog(items);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].models[0].items.map((s) => s.parameters.reasoningEffort), ["low", "high"]);
  assert.equal(identityOf(items[2]), "B / Shared / max");
  assert.equal(identityOf({ model: "OpenAI-looking name", parameters: {} }), "未记录 / OpenAI-looking name / 未记录");
  assert.deepEqual(["未记录", "default", "max", "high", "low"].sort(compareEfforts), ["low", "high", "max", "default", "未记录"]);
  assert.equal(identityOf(entry("A", "M", "custom")), "A / M / custom");
});
