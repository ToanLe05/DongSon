// Dependency-free local preview of the exact files uploaded to static hosting.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = path.resolve(option("--root", path.join(__dirname, "../dist")));
const base = option("--base", "/");
if (!base.startsWith("/") || !base.endsWith("/")) throw new Error("Base path must start/end with /");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer(async (req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405).end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
    catch { res.writeHead(400).end(); return; }
    if (!pathname.startsWith(base) || /[\\\0]/.test(pathname)) { res.writeHead(404).end(); return; }
    const relative = pathname.slice(base.length) || "index.html";
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
    try {
        const stat = await fs.promises.stat(file);
        if (!stat.isFile()) throw new Error("Not a file");
        res.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.writeHead(200);
        if (req.method === "HEAD") res.end();
        else fs.createReadStream(file).on("error", () => res.destroy()).pipe(res);
    } catch { res.writeHead(404).end(); }
});
const host = option("--host", process.env.HOST || "127.0.0.1");
const port = Number(option("--port", process.env.PORT || "8000"));
server.listen(port, host, () => console.log(`Cờ Đông Sơn: http://${host}:${port}${base}`));
