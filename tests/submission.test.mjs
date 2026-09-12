import test from "node:test";
import assert from "node:assert/strict";
import { checkContract } from "../scripts/check-pr.mjs";
const old = { id: "old-run", sourceSha256: "original", title: "Original" };
const entry = () => ({
  id: "new-run", kind: "benchmark", model: "Model", version: "v1",
  sourceSha256: "new", parameters: { reasoningEffort: "max", tools: "未记录" },
  provenance: { submitter: "contributor", executionEnvironment: "Web UI", firstOutput: true, unmodified: true, promptUnchanged: true },
  review: null,
});
test("新投稿允许生成目录与索引，失败作品不被隐藏", () => {
  const next = { ...entry(), staticCheck: { passed: false } };
  assert.equal(checkContract([old], [old, next], ["site/data/submissions.json", "site/submissions/new-run/source.html.txt"]).length, 1);
});
test("不能删除或替换已有原始输出", () => {
  assert.throws(() => checkContract([old], [], []), /删除/);
  assert.throws(() => checkContract([old], [{ ...old, sourceSha256: "changed" }], []), /原始输出/);
});
test("新投稿禁止混改代码、旧作品、未知资源和路径穿越", () => {
  for (const path of ["scripts/check-pr.mjs", ".github/workflows/submission.yml", "site/submissions/old-run/meta.json", "site/submissions/new-run/exploit.html", "site/submissions/new-run/../meta.json"])
    assert.throws(() => checkContract([old], [old, entry()], [path]), /不允许/);
  assert.throws(() => checkContract([old], [{ ...old, title: "changed" }, entry()], []), /已有元数据/);
});
test("声明不真实、不完整或自评分时拒绝混入正式批次", () => {
  for (const key of ["firstOutput", "unmodified", "promptUnchanged"]) {
    const next = entry(); next.provenance[key] = false;
    assert.throws(() => checkContract([], [next], []), /来源声明/);
  }
  const next = entry(); next.provenance.submitter = "填写 GitHub 用户名";
  assert.throws(() => checkContract([], [next], []), /submitter/);
  assert.throws(() => checkContract([], [{ ...entry(), review: { scores: {} } }], []), /自评分/);
});
test("独立证据更新允许改元数据但保留原始输出", () => {
  assert.deepEqual(checkContract([old], [{ ...old, title: "Clarified" }], ["site/submissions/old-run/meta.json"]), []);
});
