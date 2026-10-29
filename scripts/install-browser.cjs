const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const result = spawnSync(process.execPath, [
    require.resolve("@playwright/test/cli"), "install", "chromium",
], {
    cwd: root,
    stdio: "inherit",
    env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(root, ".playwright-browsers"),
    },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
