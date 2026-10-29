const { test: base, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const fixtures = JSON.parse(fs.readFileSync(path.resolve(".test-artifacts/worker-fixtures.json"), "utf8"));
const workers = new WeakMap();
const test = base.extend({
    guard: [async ({ page, context }, use) => {
        const errors = [], forbidden = [];
        page.on("pageerror", e => errors.push(e.message));
        page.on("worker", worker => { if (worker.url().includes("python.worker")) workers.set(page, worker); });
        await context.route("**/*", route => {
            const url = new URL(route.request().url());
            if (url.origin !== "http://127.0.0.1:4182" || url.pathname.includes("/api/")) {
                forbidden.push(url.href); return route.abort();
            }
            return route.continue();
        });
        await use();
        expect(errors).toEqual([]);
        expect(forbidden, "No external CDN or FastAPI requests").toEqual([]);
    }, { auto: true }],
});
async function ready(page) { await expect(page.locator("#canvas-root")).toHaveAttribute("aria-busy", "false", { timeout: 120000 }); }
async function open(page, fixture) {
    page.on("worker", worker => { if (worker.url().includes("python.worker")) workers.set(page, worker); });
    if (fixture) {
        const key = "fixture-" + test.info().testId;
        await page.context().addInitScript(key => sessionStorage.setItem("dongson.tab.v1", key), key);
        await page.goto("missing-test-position.html");
        await page.evaluate(async ({ key, snapshot }) => {
            const db = await new Promise((resolve, reject) => {
                const r = indexedDB.open("dongson-local-v1", 1);
                r.onupgradeneeded = () => r.result.createObjectStore("games");
                r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
            });
            await new Promise((resolve, reject) => {
                const tx = db.transaction("games", "readwrite"); tx.objectStore("games").put(snapshot, key);
                tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
            }); db.close();
        }, { key, snapshot: fixtures[fixture].snapshot });
    }
    await page.goto("./"); await ready(page);
    await expect(page.locator("#action-message")).toHaveText("");
    expect(workers.get(page)?.url()).toContain("/dongson/assets/python.worker");
}
async function rpc(page, endpoint = "/state", body) {
    return workers.get(page).evaluate(({ endpoint, body }) => new Promise(resolve => {
        const id = "test-" + crypto.randomUUID();
        const post = self.postMessage;
        self.postMessage = function (data, ...args) {
            if (data.id === id) { self.postMessage = post; resolve(data); }
            else post.call(self, data, ...args);
        };
        self.onmessage({ data: { type: "command", id, endpoint, body } });
    }), { endpoint, body });
}
async function state(page) { const response = await rpc(page); expect(response.ok).toBe(true); return response.result; }
async function square(page, name) {
    const box = await page.locator("canvas").boundingBox();
    const cell = Math.floor(Math.max(252, Math.min(box.width, box.height) - 96) / 9);
    await page.mouse.click(box.x + (box.width - cell * 9) / 2 + ("abcdefghk".indexOf(name[0]) + .5) * cell,
        box.y + (box.height - cell * 9) / 2 + (9 - Number(name[1]) + .5) * cell);
}
async function move(page, from, to, promotion) {
    const previous = await state(page);
    await square(page, from); await ready(page); await square(page, to);
    if (promotion) await page.getByRole("dialog").getByRole("button", { name: promotion, exact: true }).click();
    await ready(page);
    const current = await state(page);
    expect(current.lastMove).toMatchObject({ from, to });
    expect(current.revision).toBe(previous.revision + 1);
    return current;
}
async function start(page) { await page.locator("#btn-start").click(); await ready(page); }
async function resign(page) {
    await page.locator("#btn-end").click();
    await page.getByRole("button", { name: "Xác nhận đầu hàng", exact: true }).click(); await ready(page);
}
async function rematch(page) {
    const end = await state(page);
    expect(end.gameOver).toBe(true);
    const blocked = await rpc(page, "/move", { gameId: end.gameId, revision: end.revision, from: "a2", to: "a3" });
    expect(blocked.error.code).toBe("game_over");
    await page.locator("#btn-rematch").click(); await ready(page);
    const fresh = await state(page);
    expect(fresh.gameId).not.toBe(end.gameId); expect(fresh.pieces).toHaveLength(36);
    await move(page, "a2", "a3");
}
module.exports = { test, expect, workers, open, ready, rpc, state, square, move, start, resign, rematch };
