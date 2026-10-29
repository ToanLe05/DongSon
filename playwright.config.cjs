const { defineConfig } = require("@playwright/test");
const path = require("node:path");

process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(__dirname, ".playwright-browsers");

module.exports = defineConfig({
    testDir: "./tests/browser",
    fullyParallel: false,
    reporter: [["list"], ["json", { outputFile: ".test-artifacts/ui-results.json" }]],
    workers: 1,
    timeout: 90000,
    expect: { timeout: 10000 },
    maxFailures: 1,
    use: {
        baseURL: "http://127.0.0.1:4173",
        browserName: "chromium",
        channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
        headless: true,
        viewport: { width: 1100, height: 850 },
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    webServer: [
        {
            command: "node scripts/run-python.cjs -m uvicorn browser_server:app --app-dir tests --host 127.0.0.1 --port 8001 --workers 1",
            url: "http://127.0.0.1:8001/ping",
            reuseExistingServer: false,
        },
        {
            command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
            env: { VITE_ENGINE: "api", VITE_API_URL: "http://127.0.0.1:8001" },
            url: "http://127.0.0.1:4173",
            reuseExistingServer: false,
        },
    ],
});
