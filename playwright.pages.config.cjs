const { defineConfig } = require("@playwright/test");
const path = require("node:path");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(__dirname, ".playwright-browsers");
module.exports = defineConfig({
    testDir: "./tests/pages-browser",
    outputDir: ".test-artifacts/pages-test-results",
    workers: 1, timeout: 180000, expect: { timeout: 15000 }, maxFailures: 1,
    reporter: [["list"], ["json", { outputFile: ".test-artifacts/pages-ui-results.json" }]],
    use: { baseURL: "http://127.0.0.1:4184/DongSon/", browserName: "chromium", headless: true,
           viewport: { width: 1100, height: 850 }, trace: "retain-on-failure", screenshot: "only-on-failure" },
    webServer: [
        { command: "node scripts/serve-static.cjs --root dist --port 4186",
          url: "http://127.0.0.1:4186/", reuseExistingServer: false },
        { command: "node scripts/serve-static.cjs --root dist-pages --port 4184 --base /DongSon/",
          url: "http://127.0.0.1:4184/DongSon/", reuseExistingServer: false },
        { command: "npm run dev -- --host 127.0.0.1 --port 4185 --strictPort --base /DongSon/",
          env: { VITE_ENGINE: "local" }, url: "http://127.0.0.1:4185/DongSon/", reuseExistingServer: false },
    ],
});
