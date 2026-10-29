const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
if (process.platform !== "win32") throw new Error("Build the Windows exe on Windows.");
const python = path.join(root, ".venv-desktop", "Scripts", "python.exe");
if (!fs.existsSync(python)) throw new Error("Create .venv-desktop and install src/requirements-desktop.txt first.");
const output = path.join(root, ".desktop-build", "web");
if (!output.startsWith(root + path.sep)) throw new Error("Invalid build output.");
function run(binary, args, env = {}) {
    const result = spawnSync(binary, args, {
        cwd: root, stdio: "inherit", env: { ...process.env, PYTHONUTF8: "1", ...env },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"),
    "build", "--outDir", output, "--emptyOutDir"], { VITE_ENGINE: "api", VITE_API_URL: "/api", VITE_BASE_PATH: "./" });
run(python, ["-m", "PyInstaller", "--noconfirm",
    "--distpath", path.join(root, "release"),
    "--workpath", path.join(root, ".desktop-build", "pyinstaller"),
    path.join(root, "packaging", "CoDongSon.spec")],
    { PYINSTALLER_CONFIG_DIR: path.join(root, ".desktop-build", "cache") });
fs.copyFileSync(path.join(root, "release", "CoDongSon.exe"), path.join(root, "CoDongSon.exe"));
console.log("Ready: " + path.join(root, "CoDongSon.exe"));
