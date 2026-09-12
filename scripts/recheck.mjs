import { readFile, writeFile, rm } from "node:fs/promises";
import { checkSource, makePreview, safeId, sha256 } from "./lib.mjs";
const entries = JSON.parse(
  await readFile("site/data/submissions.json", "utf8"),
);
for (const entry of entries) {
  if (!safeId(entry.id)) throw new Error("Unsafe id");
  const directory = `site/submissions/${entry.id}`;
  const bytes = await readFile(`${directory}/source.html.txt`);
  if (sha256(bytes) !== entry.sourceSha256)
    throw new Error(`Source was changed: ${entry.id}`);
  const source = bytes.toString("utf8");
  entry.staticCheck = checkSource(source);
  if (entry.staticCheck.passed)
    await writeFile(
      `${directory}/preview.html`,
      makePreview(source, entry.title),
    );
  else await rm(`${directory}/preview.html`, { force: true });
  await writeFile(
    `${directory}/meta.json`,
    JSON.stringify(entry, null, 2) + "\n",
  );
}
await writeFile(
  "site/data/submissions.json",
  JSON.stringify(entries, null, 2) + "\n",
);
console.log(`Rechecked ${entries.length} immutable submissions`);
