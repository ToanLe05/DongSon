const { normalizeBase } = require("./scripts/pages-base.cjs");

module.exports = {
    base: normalizeBase(process.env.VITE_BASE_PATH || "./", { relative: true }),
    plugins: [require("./scripts/pyodide-assets.cjs")()],
    worker: { format: "es" },
    server: {
        proxy: { "/api": { target: "http://127.0.0.1:8000", rewrite: path => path.replace(/^\/api/, "") } },
        watch: {
            ignored: [
                "**/.venv/**", "**/.venv-desktop/**", "**/.desktop-build/**",
                "**/.test-artifacts/**", "**/.playwright-browsers/**",
                "**/.npm-cache/**", "**/.pip-cache/**",
                "**/release/**", "**/test-results/**", "**/CoDongSon.exe", "**/dist-pages/**"
            ]
        }
    },
    build: { target: "es2022" }
};
