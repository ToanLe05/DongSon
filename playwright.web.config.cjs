const { defineConfig } = require("@playwright/test");
// Legacy HTTP host tests: build with VITE_ENGINE=api before running this config.
// The default static/Worker suite is playwright.local.config.cjs.
const path = require("node:path");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(__dirname, ".playwright-browsers");
module.exports = defineConfig({
    testDir: "./tests/web-browser",
    outputDir: ".test-artifacts/web-test-results",
    workers: 1,
    timeout: 90000,
    expect: { timeout: 15000 },
    reporter: [["list"], ["json", { outputFile: ".test-artifacts/web-ui-results.json" }]],
    use: { baseURL: "http://127.0.0.1:4180", browserName: "chromium", headless: true,
           viewport: { width: 1100, height: 850 }, trace: "retain-on-failure", screenshot: "only-on-failure" },
    webServer: {
        command: "node scripts/run-python.cjs -m uvicorn web:app --app-dir src --host 127.0.0.1 --port 4180 --workers 1",
        url: "http://127.0.0.1:4180/health", reuseExistingServer: false,
    },
});
