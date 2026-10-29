const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pagesBase } = require("./pages-base.cjs");
const args = process.argv.slice(2);
const option = name => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing ${name} value.`);
    return args[i + 1];
};
try {
    for (let i = 0; i < args.length; i += 2) {
        if (!["--repository", "--base"].includes(args[i])) throw new Error(`Unknown option: ${args[i]}`);
    }
    const base = pagesBase({ repository: option("--repository") || process.env.GITHUB_REPOSITORY,
                             base: option("--base") || process.env.PAGES_BASE_PATH });
    const root = path.resolve(__dirname, "..");
    console.log(`GitHub Pages base: ${base}`);
    const result = spawnSync(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"),
        "build", "--base", base, "--outDir", "dist-pages"], {
        cwd: root, stdio: "inherit",
        env: { ...process.env, VITE_BASE_PATH: base, VITE_ENGINE: "local", VITE_API_URL: "" },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
    fs.writeFileSync(path.join(root, "dist-pages/.nojekyll"), "");
    console.log("Ready: dist-pages/");
} catch (error) { console.error(error.message); process.exit(1); }
