import { createHash } from "node:crypto";
import { parse } from "parse5";
export const sha256 = (content) =>
  createHash("sha256").update(content).digest("hex");
export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const safeId = (value) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);
export const previewCSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export function checkSource(source) {
  const issues = [];
  if (Buffer.byteLength(source) > 1024 * 1024)
    issues.push("原始输出超过 1 MiB 限制");
  if (!/^\s*<!doctype html>/i.test(source) || !/<\/html>\s*$/i.test(source))
    issues.push("必须直接输出完整 HTML，不能带解释或代码围栏");
  const tree = parse(source);
  const forbidden = new Set([
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "base",
    "form",
    "portal",
    "applet",
    "image",
    "img",
    "audio",
    "video",
    "source",
    "track",
    "foreignobject",
  ]);
  const network =
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|Worker|SharedWorker|serviceWorker|location|window\s*\.\s*open|document\s*\.\s*(?:write|domain)|eval)\b|\bFunction\s*\(|\bimport\s*(?:\(|[{'"*])/;
  const cssExternal = /url\s*\(|@import|@font-face|image-set\s*\(|\\/i;
  const hasExternalCSS = (value) =>
    cssExternal.test(
      value.replace(/url\(\s*(['"]?)#[a-zA-Z0-9_-]+\1\s*\)/gi, ""),
    );
  function walk(node) {
    const tag = node.tagName?.toLowerCase();
    if (forbidden.has(tag)) issues.push(`不允许的标签：${tag}`);
    const attrs = node.attrs || [];
    let inlineIcon = false;
    if (tag === "link") {
      const href = attrs.find((a) => a.name === "href")?.value || "";
      const rel = attrs.find((a) => a.name === "rel")?.value || "";
      if (rel === "icon" && href.startsWith("data:image/svg+xml,")) {
        try {
          const svg = decodeURIComponent(
            href.slice("data:image/svg+xml,".length),
          );
          if (/^\s*<svg\b/i.test(svg) && !/<script\b/i.test(svg)) {
            inlineIcon = true;
            walk(parse(svg));
          }
        } catch {}
      }
      if (!inlineIcon)
        issues.push("仅允许自包含 SVG 图标，不允许外部 link 资源");
    }
    if (tag === "meta" && attrs.some((a) => a.name === "http-equiv"))
      issues.push("不允许作品覆盖响应策略或自动跳转");
    for (const { name, value } of attrs) {
      if (/^on/i.test(name) && network.test(value))
        issues.push("事件处理器包含网络、导航或动态代码执行接口");
      if (
        name.toLowerCase() === "attributename" &&
        /^(?:href|xlink:href|src|srcdoc|on\w+)$/i.test(value)
      )
        issues.push("SVG 动画不允许改变导航、资源或事件属性");
      if (
        [
          "src",
          "srcset",
          "action",
          "formaction",
          "ping",
          "poster",
          "data",
          "manifest",
          "codebase",
          "background",
          "srcdoc",
        ].includes(name)
      )
        issues.push(`不允许资源或导航属性：${name}`);
      if (name === "href" && !inlineIcon && !/^#[a-zA-Z0-9_-]+$/.test(value))
        issues.push("仅允许指向本页片段的链接");
      if (
        (name === "style" || /url\s*\(/i.test(value)) &&
        hasExternalCSS(value)
      )
        issues.push("样式中不允许资源加载或转义");
    }
    const text = (node.childNodes || [])
      .filter((n) => n.nodeName === "#text")
      .map((n) => n.value)
      .join("");
    if (tag === "script" && network.test(text))
      issues.push("脚本包含网络、导航或动态代码执行接口");
    if (tag === "style" && hasExternalCSS(text))
      issues.push("样式中不允许资源加载或转义");
    for (const child of node.childNodes || []) walk(child);
    if (node.content) walk(node.content);
  }
  walk(tree);
  return { passed: !issues.length, issues: [...new Set(issues)], version: 2 };
}
export function makePreview(source, title) {
  // Raw source is always nested in a sandbox, even when preview.html is opened directly.
  // The policy appears before any untrusted content; the source is never top-level markup.
  const inner =
    `<!doctype html><meta http-equiv="Content-Security-Policy" content="${previewCSP}">` +
    source;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml"><title>${escapeHTML(title)} · 沙盒预览</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block;overflow:hidden}</style></head><body><iframe title="${escapeHTML(title)}" sandbox="allow-scripts" referrerpolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" srcdoc="${escapeHTML(inner)}"></iframe></body></html>\n`;
}
export function validateMeta(meta, prompt) {
  if (!safeId(meta.id))
    throw new Error("id 只能含小写字母、数字、连字符，最多 80 字符");
  if (!["demo", "benchmark"].includes(meta.kind))
    throw new Error("kind 必须为 demo 或 benchmark");
  for (const key of ["title", "description", "model", "version", "input"])
    if (typeof meta[key] !== "string" || !meta[key].trim())
      throw new Error(`缺少字段：${key}`);
  if (meta.kind === "benchmark" &&
      (typeof meta.modelProvider !== "string" || !meta.modelProvider.trim() || meta.modelProvider.includes("填写")))
    throw new Error("请填写 modelProvider");
  if (
    meta.generatedAt !== null &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(meta.generatedAt) ||
      Number.isNaN(Date.parse(meta.generatedAt)) ||
      new Date(meta.generatedAt).toISOString().slice(0, 10) !==
        meta.generatedAt)
  )
    throw new Error("generatedAt 必须是有效的 YYYY-MM-DD 日期");
  if (meta.promptVersion !== prompt.version || meta.input !== prompt.text)
    throw new Error("完整输入必须与固定提示词 v1 完全相同");
  if (
    !meta.parameters ||
    typeof meta.parameters !== "object" ||
    Array.isArray(meta.parameters)
  )
    throw new Error("必须记录 parameters 对象，未知参数请标注未记录");
  if (meta.review) {
    if (meta.kind === "demo") throw new Error("演示作品不能计分");
    if (!meta.review.reviewer || !meta.review.date)
      throw new Error("评分必须附带评审者与日期");
    for (const key of [
      "runnable",
      "visual",
      "animation",
      "accessibility",
      "quality",
    ])
      if (
        !Number.isFinite(meta.review.scores?.[key]) ||
        meta.review.scores[key] < 0 ||
        meta.review.scores[key] > 10 ||
        typeof meta.review.notes?.[key] !== "string" ||
        !meta.review.notes[key].trim()
      )
        throw new Error("评分必须具备五个 0–10 分的维度及文字依据");
  }
}
