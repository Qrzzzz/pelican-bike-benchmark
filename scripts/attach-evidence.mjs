import { readFile, writeFile } from "node:fs/promises";
import { sha256, safeId } from "./lib.mjs";
const log = await readFile(process.argv[2], "utf8");
const text = log.includes("### Result")
  ? log
      .split(/### Result\r?\n/)[1]
      .split(/\r?\n### /)[0]
      .trim()
  : log;
const results = JSON.parse(text);
const entries = JSON.parse(
  await readFile("site/data/submissions.json", "utf8"),
);
for (const evidence of results) {
  const entry = entries.find((s) => s.id === evidence.id);
  if (!entry || !safeId(entry.id)) throw new Error("Unknown entry");
  const dir = `site/submissions/${entry.id}`;
  if (sha256(await readFile(`${dir}/source.html.txt`)) !== entry.sourceSha256)
    throw new Error("Original source changed");
  if (evidence.checks) {
    entry.runtimeChecks = (entry.runtimeChecks || [])
      .filter((c) => !evidence.checks.some((n) => n.name === c.name))
      .concat(evidence.checks);
    if (entry.environment)
      entry.environment.reducedMotionTest =
        "独立 Chromium 实例使用 --force-prefers-reduced-motion；上下文 reduce；验证 iframe 媒体查询为 true";
  } else {
    for (const [view, width, height] of [
      ["desktop", 1200, 800],
      ["mobile", 390, 844],
    ]) {
      if (evidence.screenshots[view] !== `${view}.png`)
        throw new Error("Invalid evidence path");
      const image = await readFile(`${dir}/${view}.png`);
      if (image.readUInt32BE(16) !== width || image.readUInt32BE(20) !== height)
        throw new Error("Screenshot size mismatch");
    }
    entry.screenshots = evidence.screenshots;
    entry.cover = evidence.screenshots.desktop;
    entry.environment = evidence.environment;
    entry.runtimeChecks = evidence.runtimeChecks;
  }
  entry.screenshotSha256 = {};
  for (const view of ["desktop", "mobile"])
    entry.screenshotSha256[view] = sha256(await readFile(`${dir}/${view}.png`));
  await writeFile(`${dir}/meta.json`, JSON.stringify(entry, null, 2) + "\n");
  console.log(
    entry.id,
    JSON.stringify(
      Object.fromEntries(
        ["pass", "fail", "not-tested"].map((s) => [
          s,
          entry.runtimeChecks.filter((c) => c.status === s).length,
        ]),
      ),
    ),
  );
}
await writeFile(
  "site/data/submissions.json",
  JSON.stringify(entries, null, 2) + "\n",
);
