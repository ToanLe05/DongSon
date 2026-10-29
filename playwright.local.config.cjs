const { defineConfig } = require("@playwright/test");
const path = require("node:path");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(__dirname, ".playwright-browsers");
module.exports = defineConfig({
    testDir: "./tests/local-browser",
    outputDir: ".test-artifacts/local-test-results",
    workers: 1, timeout: 180000, expect: { timeout: 15000 }, maxFailures: 1,
    reporter: [["list"], ["json", { outputFile: ".test-artifacts/local-ui-results.json" }]],
    use: { baseURL: "http://127.0.0.1:4182/dongson/", browserName: "chromium", headless: true,
           viewport: { width: 1100, height: 850 }, trace: "retain-on-failure", screenshot: "only-on-failure" },
    webServer: { command: "node scripts/serve-static.cjs --port 4182 --base /dongson/",
                 url: "http://127.0.0.1:4182/dongson/", reuseExistingServer: false },
});
