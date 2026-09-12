import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, lstat, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { sha256, safeId } from "./lib.mjs";

export function checkContract(before, after, paths) {
  const previous = new Map(before.map(e => [e.id, e]));
  const current = new Map(after.map(e => [e.id, e]));
  assert.equal(current.size, after.length, "重复 id");
  for (const old of before) {
    assert(current.has(old.id), `不得删除已有作品 ${old.id}；撤稿请由维护者单独处理`);
    assert.equal(current.get(old.id).sourceSha256, old.sourceSha256, `不得修改原始输出 ${old.id}`);
  }
  const added = after.filter(e => !previous.has(e.id));
  for (const e of added) {
    assert(safeId(e.id) && e.kind === "benchmark", "只接受正式投稿及合法 id");
    for (const key of ["firstOutput", "unmodified", "promptUnchanged"])
      assert.equal(e.provenance?.[key], true, `${e.id} 缺少来源声明 ${key}`);
    for (const key of ["submitter", "executionEnvironment"])
      assert(typeof e.provenance?.[key] === "string" && e.provenance[key].trim() && !e.provenance[key].includes("填写"), `${e.id} 请填写 ${key}`);
    for (const key of ["model", "version"])
      assert(typeof e[key] === "string" && !e[key].includes("填写"), `${e.id} 请填写 ${key}`);
    for (const key of ["reasoningEffort", "tools"])
      assert(typeof e.parameters?.[key] === "string" && e.parameters[key].trim(), `${e.id} 请记录参数 ${key}`);
    assert.equal(e.review, null, "新投稿不附自评分；评审通过后续独立 PR 提交");
  }
  if (added.length) {
    for (const old of before) assert.deepEqual(current.get(old.id), old, "新投稿 PR 不得修改已有元数据，请拆分 PR");
    const ids = new Set(added.map(e => e.id));
    for (const path of paths) {
      if (path === "site/data/submissions.json") continue;
      const match = /^site\/submissions\/([^/]+)\/(meta\.json|source\.html\.txt|preview\.html|(?:desktop|mobile)\.(?:png|webp))$/.exec(path);
      assert(match && ids.has(match[1]), `投稿 PR 含无关或不允许的文件：${path}`);
    }
  }
  return added;
}

async function main() {
  const report = { passed: false, added: [], errors: [] };
  try {
    const ref = process.argv[2] || process.env.BASE_SHA || "origin/main";
    assert(/^[a-zA-Z0-9_./-]+$/.test(ref) && !ref.startsWith("-"), "无效的基准引用");
    const git = (...args) => execFileSync("git", args, { maxBuffer: 20 * 1024 * 1024 });
    const base = git("rev-parse", "--verify", `${ref}^{commit}`).toString().trim();
    const before = JSON.parse(git("show", `${base}:site/data/submissions.json`).toString());
    const after = JSON.parse(await readFile("site/data/submissions.json", "utf8"));
    const paths = [...new Set((git("diff", "--name-only", "-z", base).toString() + git("ls-files", "--others", "--exclude-standard", "-z").toString()).split("\0").filter(Boolean))];
    const added = checkContract(before, after, paths);
    assert.deepEqual((await readdir("site/submissions")).sort(), after.map(e => e.id).sort(), "作品目录与索引不一致");
    for (const e of before) {
      const path = `site/submissions/${e.id}/source.html.txt`;
      assert.equal(sha256(await readFile(path)), sha256(git("show", `${base}:${path}`)), `原始字节被修改：${e.id}`);
    }
    for (const e of after) {
      const directory = `site/submissions/${e.id}`;
      assert(!(await lstat(directory)).isSymbolicLink(), "作品目录不得为符号链接");
      for (const file of await readdir(directory)) {
        assert(/^(meta\.json|source\.html\.txt|preview\.html|(?:desktop|mobile)\.(png|webp))$/.test(file), `不允许的投稿文件 ${file}`);
        const stat = await lstat(`${directory}/${file}`);
        assert(stat.isFile() && !stat.isSymbolicLink(), "投稿仅接受普通文件");
        const limit = file === "source.html.txt" ? 1 : file.endsWith(".png") || file.endsWith(".webp") ? 10 : 3;
        assert(stat.size <= limit * 1024 * 1024, "投稿文件过大");
      }
    }
    report.base = base;
    report.added = added.map(e => ({ id: e.id, sourceSha256: e.sourceSha256, staticCheck: e.staticCheck, screenshots: e.screenshots }));
    report.passed = true;
    console.log(`PR 投稿规范通过：${added.length} 个新作品，已有原始输出保持不变。`);
  } catch (error) {
    report.errors.push(error.message);
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mkdir("output", { recursive: true });
    await writeFile("output/submission-report.json", JSON.stringify(report, null, 2) + "\n");
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
