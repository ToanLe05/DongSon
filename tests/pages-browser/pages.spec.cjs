const { test, expect } = require("@playwright/test");

async function ready(page) {
    await expect(page.locator("#canvas-root")).toHaveAttribute("aria-busy", "false", { timeout: 120000 });
}
async function square(page, name) {
    const box = await page.locator("canvas").boundingBox();
    const cell = Math.floor(Math.max(252, Math.min(box.width, box.height) - 96) / 9);
    await page.mouse.click(box.x + (box.width - cell * 9) / 2 + ("abcdefghk".indexOf(name[0]) + .5) * cell,
        box.y + (box.height - cell * 9) / 2 + (9 - Number(name[1]) + .5) * cell);
}
async function play(page) {
    await page.locator("#btn-start").click(); await ready(page);
    await square(page, "a2"); await ready(page); await square(page, "a3"); await ready(page);
    await expect(page.locator("#status-line")).toHaveText("Đến lượt Sơn Tinh.");
}
async function watch(context, page, origin, { development = false, base = "/DongSon/" } = {}) {
    const failures = [], errors = [], requests = new Set();
    page.on("pageerror", error => errors.push(error.message));
    context.on("response", response => {
        if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    await context.route("**/*", route => {
        const url = new URL(route.request().url());
        requests.add(url.href);
        if (url.origin !== origin || !url.pathname.startsWith(base) || url.pathname.includes("/api/")
            || (!development && (url.pathname.includes("/src/") || url.pathname.endsWith(".py")))) {
            failures.push(url.href); return route.abort();
        }
        return route.continue();
    });
    return { failures, errors, requests };
}

test("Pages build: index.html loads every asset under the exact repository path and plays", async ({ page, context }, info) => {
    const log = await watch(context, page, "http://127.0.0.1:4184");
    await page.goto("index.html"); await ready(page);
    expect(await page.locator('link[rel="icon"]').getAttribute("href")).toMatch(/^\/DongSon\/assets\//);
    await play(page);
    await page.locator("#btn-end").click();
    await page.getByRole("button", { name: "Xác nhận đầu hàng", exact: true }).click(); await ready(page);
    await page.locator("#btn-rematch").click(); await ready(page);
    await square(page, "a2"); await ready(page); await square(page, "a3"); await ready(page);
    await expect(page.locator("#status-line")).toHaveText("Đến lượt Sơn Tinh.");
    const urls = [...log.requests];
    expect(urls.filter(url => /\.(png|jpg|jpeg|svg|webp)(\?|$)/.test(url)).length).toBeGreaterThanOrEqual(16);
    for (const name of ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
        expect(urls.some(url => new URL(url).pathname === "/DongSon/python-runtime/" + name), name).toBe(true);
    }
    expect(urls.some(url => url.includes("/DongSon/assets/python.worker-"))).toBe(true);
    expect(await page.locator("body").evaluate(el => getComputedStyle(el).fontFamily)).toContain("Arial");
    expect(log.errors).toEqual([]); expect(log.failures).toEqual([]);
    await info.attach("pages-asset-requests", { body: JSON.stringify(urls, null, 2), contentType: "application/json" });
    await page.screenshot({ path: ".test-artifacts/ui-screenshots/github-pages-index.png" });
});

test("Portable build also plays from index.html at the website root", async ({ page, context }) => {
    const log = await watch(context, page, "http://127.0.0.1:4186", { base: "/" });
    await page.goto("http://127.0.0.1:4186/index.html"); await ready(page);
    await play(page);
    expect(log.errors).toEqual([]); expect(log.failures).toEqual([]);
    expect([...log.requests].some(url => new URL(url).pathname === "/python-runtime/pyodide.asm.wasm")).toBe(true);
});

test("Pages runtime uses the correct MIME and paths are case-sensitive", async ({ request }) => {
    for (const [file, mime] of [["pyodide.mjs", "text/javascript"], ["pyodide.asm.wasm", "application/wasm"],
        ["python_stdlib.zip", "application/zip"], ["pyodide-lock.json", "application/json"]]) {
        const response = await request.head("python-runtime/" + file);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain(mime);
    }
    expect((await request.get("http://127.0.0.1:4184/python-runtime/pyodide.mjs")).status()).toBe(404);
    expect((await request.get("http://127.0.0.1:4184/dongson/index.html")).status()).toBe(404);
    expect((await request.get(".nojekyll")).status()).toBe(200);
});

test("Vite development with a repository base also resolves Python and images", async ({ page, context }) => {
    const log = await watch(context, page, "http://127.0.0.1:4185", { development: true });
    await page.goto("http://127.0.0.1:4185/DongSon/index.html"); await ready(page);
    await play(page);
    expect(log.errors).toEqual([]); expect(log.failures).toEqual([]);
    expect([...log.requests].some(url => url.includes("/DongSon/python-runtime/pyodide.asm.wasm"))).toBe(true);
});
