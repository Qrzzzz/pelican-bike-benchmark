import { readFile, writeFile, mkdir, rename, rm, open } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkSource, makePreview, sha256, validateMeta } from "./lib.mjs";
export async function importEntry(options) {
  const root = options.root || resolve("site");
  const lockPath = join(root, "data", ".import.lock");
  let lock;
  try { lock = await open(lockPath, "wx"); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("另一个导入正在进行；请稍后重试。如上次进程异常退出，请确认没有导入进程后移除 data/.import.lock。");
    throw error;
  }
  try { return await importUnlocked({ ...options, root }); }
  finally { await lock.close(); await rm(lockPath, { force: true }); }
}
async function importUnlocked({
  sourcePath,
  metaPath,
  desktop,
  mobile,
  root = resolve("site"),
}) {
  const prompt = JSON.parse(
    await readFile(join(root, "data/prompt.v1.json"), "utf8"),
  );
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  validateMeta(meta, prompt);
  const entries = JSON.parse(
    await readFile(join(root, "data/submissions.json"), "utf8"),
  );
  if (entries.some((s) => s.id === meta.id))
    throw new Error("该 id 已存在；请使用新的运行 id，避免覆盖原始结果");
  const sourceBytes = await readFile(sourcePath);
  if (sourceBytes.length > 1024 * 1024)
    throw new Error("原始输出超过 1 MiB，未导入");
  const source = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(sourceBytes);
  const check = checkSource(source);
  const screenshots = {};
  const imageBytes = {};
  for (const [view, path] of Object.entries({ desktop, mobile })) {
    if (!path) continue;
    const extension = extname(path).toLowerCase();
    if (![".png", ".webp"].includes(extension))
      throw new Error("截图只接受 PNG 或 WebP");
    const image = await readFile(path);
    if (image.length > 10 * 1024 * 1024)
      throw new Error("单张截图不能超过 10 MiB");
    if (
      extension === ".png" &&
      !image
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      throw new Error("PNG 文件格式无效");
    if (
      extension === ".webp" &&
      (image.toString("ascii", 0, 4) !== "RIFF" ||
        image.toString("ascii", 8, 12) !== "WEBP")
    )
      throw new Error("WebP 文件格式无效");
    if (extension === ".png" && (image.length < 33 || image.toString("ascii", 12, 16) !== "IHDR" ||
      image.readUInt32BE(16) !== (view === "desktop" ? 1200 : 390) ||
      image.readUInt32BE(20) !== (view === "desktop" ? 800 : 844)))
      throw new Error("PNG 截图尺寸必须为桌面 1200×800 或手机 390×844");
    if (
      !meta.environment?.browser ||
      !meta.environment?.captureAt ||
      !meta.environment?.motion ||
      meta.environment?.dpr !== 1
    )
      throw new Error(
        "截图必须记录 environment.browser、captureAt、motion 和 dpr: 1",
      );
    const filename = view + extension;
    screenshots[view] = filename;
    imageBytes[filename] = image;
  }
  // Select metadata fields explicitly so paths / check results cannot be supplied by metadata.
  const entry = {
    id: meta.id,
    kind: meta.kind,
    title: meta.title,
    description: meta.description,
    modelProvider: meta.modelProvider,
    model: meta.model,
    version: meta.version,
    generatedAt: meta.generatedAt,
    promptVersion: meta.promptVersion,
    input: meta.input,
    parameters: meta.parameters,
    tech: meta.tech || "HTML",
    environment: meta.environment || null,
    review: meta.review || null,
    provenance: meta.provenance || null,
    runtimeChecks: meta.runtimeChecks || null,
    sourceSha256: sha256(sourceBytes),
    staticCheck: check,
    screenshots,
    screenshotSha256: Object.fromEntries(
      Object.entries(screenshots).map(([view, file]) => [
        view,
        sha256(imageBytes[file]),
      ]),
    ),
    cover: screenshots.desktop || null,
  };
  const directory = join(root, "submissions", meta.id);
  await mkdir(directory, { recursive: false });
  try {
    await writeFile(join(directory, "source.html.txt"), sourceBytes);
    await writeFile(
      join(directory, "meta.json"),
      JSON.stringify(entry, null, 2) + "\n",
    );
    if (check.passed)
      await writeFile(
        join(directory, "preview.html"),
        makePreview(source, entry.title),
      );
    for (const [file, bytes] of Object.entries(imageBytes))
      await writeFile(join(directory, file), bytes);
    const manifest = join(root, "data/submissions.json");
    const temporary = manifest + ".tmp";
    await writeFile(
      temporary,
      JSON.stringify([...entries, entry], null, 2) + "\n",
    );
    await rename(temporary, manifest);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return entry;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2),
      options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (
        !["--source", "--meta", "--desktop", "--mobile"].includes(args[i]) ||
        !args[i + 1]
      )
        throw new Error(
          "用法：npm run import -- --source result.txt --meta meta.json [--desktop desktop.png --mobile mobile.png]",
        );
      options[args[i].slice(2)] = args[i + 1];
    }
    if (!options.source || !options.meta)
      throw new Error("必须提供 --source 和 --meta");
    const entry = await importEntry({
      sourcePath: options.source,
      metaPath: options.meta,
      desktop: options.desktop,
      mobile: options.mobile,
    });
    console.log(
      `已导入 ${entry.id}；静态检查${entry.staticCheck.passed ? "通过" : "未通过，预览停用"}；SHA-256 ${entry.sourceSha256}`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
