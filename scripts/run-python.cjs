const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const python = process.env.DONGSON_PYTHON || path.join(
    root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
);
if (!existsSync(python)) {
    console.error("Chưa có Python của dự án. Tạo .venv và cài src/requirements-dev.txt theo readme.md.");
    process.exit(1);
}
const result = spawnSync(python, process.argv.slice(2), {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PYTHONUTF8: "1" },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
