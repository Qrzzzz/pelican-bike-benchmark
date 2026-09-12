import http from "node:http";
import { open, realpath } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp", ".png": "image/png",
};
export function createPreviewServer({ root = resolve("site") } = {}) {
  const rootPath = realpath(root);
  return http.createServer(async (req, res) => {
    let handle;
    const reply = (status, message, headers = {}) => {
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers });
      res.end(req.method === "HEAD" ? undefined : message);
    };
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-cache");
    if (!["GET", "HEAD"].includes(req.method)) return reply(405, "Method not allowed", { Allow: "GET, HEAD" });
    try {
      let path;
      const url = new URL(req.url, "http://localhost");
      try { path = decodeURIComponent(url.pathname); }
      catch { return reply(400, "Invalid URL encoding"); }
      if (path.includes("\0") || path.includes("\\") || path.includes(":")) return reply(400, "Invalid path");
      const prefix = "/pelican-bike-benchmark";
      if (path === prefix) return reply(302, "Redirecting", { Location: prefix + "/" + url.search });
      if (path.startsWith(prefix + "/")) path = path.slice(prefix.length);
      const base = await rootPath;
      const candidate = resolve(base, "." + path + (path.endsWith("/") ? "index.html" : ""));
      if (!candidate.startsWith(base + sep)) return reply(404, "Not found");
      const file = await realpath(candidate);
      if (!file.startsWith(base + sep)) return reply(404, "Not found");
      handle = await open(file, "r");
      const info = await handle.stat();
      if (!info.isFile()) return reply(404, "Not found");
      const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
      res.setHeader("ETag", etag);
      res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
      if (req.headers["if-none-match"]?.split(",").map((s) => s.trim()).some((s) => s === etag || s === "*")) {
        res.writeHead(304);
        return res.end();
      }
      res.setHeader("Content-Length", info.size);
      if (req.method === "HEAD") { res.writeHead(200); return res.end(); }
      await pipeline(handle.createReadStream({ autoClose: false }), res);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) reply(["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(error.code) ? 404 : 500, "Unable to serve file");
      else res.destroy();
    } finally {
      await handle?.close();
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createPreviewServer();
  server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
    console.log(`Preview: http://127.0.0.1:${server.address().port}/pelican-bike-benchmark/`));
}
