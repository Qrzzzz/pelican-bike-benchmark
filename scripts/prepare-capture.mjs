import { readFile, writeFile, mkdir } from "node:fs/promises";
import { safeId } from "./lib.mjs";
const entries = JSON.parse(
  await readFile("site/data/submissions.json", "utf8"),
);
const ids = process.argv.slice(2);
if (!ids.length) throw new Error("提供需要实测的作品 id，可同时给出多个。");
for (const id of ids)
  if (!safeId(id) || !entries.some((s) => s.id === id && s.staticCheck.passed))
    throw new Error("作品不存在或静态检查未通过：" + id);
await mkdir("output", { recursive: true });
for (const [template, destination] of [
  ["capture-browser", "capture"],
  ["reduced-browser", "reduced-check"],
])
  await writeFile(
    `output/${destination}.js`,
    (await readFile(`scripts/${template}.template.js`, "utf8")).replace(
      "__IDS__",
      JSON.stringify(ids),
    ),
  );
await writeFile(
  "output/reduced-browser.json",
  JSON.stringify(
    {
      browser: {
        browserName: "chromium",
        launchOptions: { args: ["--force-prefers-reduced-motion"] },
        contextOptions: {
          reducedMotion: "reduce",
          viewport: { width: 1200, height: 800 },
          deviceScaleFactor: 1,
        },
      },
    },
    null,
    2,
  ),
);
console.log(
  `已生成 ${ids.length} 个作品的实测脚本。先 npm run dev，再按 README 的捕获命令执行。`,
);
