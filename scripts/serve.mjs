import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("site");
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".png": "image/png",
};
http
  .createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const prefix = "/pelican-bike-benchmark";
      if (path === prefix) {
        res.writeHead(302, { Location: prefix + "/" });
        return res.end();
      }
      if (path.startsWith(prefix + "/")) path = path.slice(prefix.length);
      const file = resolve(
        root,
        "." + path + (path.endsWith("/") ? "index.html" : ""),
      );
      if (!file.startsWith(root + sep)) throw new Error("outside root");
      const content = await readFile(file);
      res.writeHead(200, {
        "Content-Type":
          (types[extname(file)] || "application/octet-stream") +
          "; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
    console.log("Preview: http://127.0.0.1:4173/pelican-bike-benchmark/"),
  );
