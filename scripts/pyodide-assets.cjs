// Serve/build only the pinned runtime files needed by the stdlib-only engine.
const fs = require("node:fs");
const path = require("node:path");
const RUNTIME = ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
const root = path.dirname(require.resolve("pyodide/package.json"));
module.exports = function pyodideAssets() {
    let prefix = "/python-runtime/";
    const mime = { ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                   ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip" };
    return {
        name: "dongson-python-runtime",
        configResolved(config) {
            prefix = `${config.base === "./" ? "/" : config.base}python-runtime/`;
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const pathname = new URL(req.url, "http://vite.local").pathname;
                if (!pathname.startsWith(prefix) || !["GET", "HEAD"].includes(req.method)) return next();
                const name = pathname.slice(prefix.length);
                if (!RUNTIME.includes(name)) return next();
                res.setHeader("Content-Type", mime[path.extname(name)]);
                res.setHeader("Cache-Control", "no-cache");
                if (req.method === "HEAD") return res.end();
                fs.createReadStream(path.join(root, name)).on("error", () => {
                    if (!res.headersSent) res.statusCode = 404;
                    res.end();
                }).pipe(res);
            });
        },
        generateBundle() {
            for (const name of RUNTIME) this.emitFile({ type: "asset", fileName: `python-runtime/${name}`, source: fs.readFileSync(path.join(root, name)) });
        },
    };
};
