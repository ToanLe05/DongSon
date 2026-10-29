const { test, expect } = require("@playwright/test");

async function ready(page) {
    await expect(page.locator("#canvas-root")).toHaveAttribute("aria-busy", "false");
}
async function square(page, name) {
    const box = await page.locator("canvas").boundingBox();
    const cell = Math.floor(Math.max(252, Math.min(box.width, box.height) - 96) / 9);
    await page.mouse.click(box.x + (box.width - cell * 9) / 2 + ("abcdefghk".indexOf(name[0]) + .5) * cell,
        box.y + (box.height - cell * 9) / 2 + (9 - Number(name[1]) + .5) * cell);
}
async function move(page, from, to) {
    await page.bringToFront();
    await ready(page);
    await Promise.all([page.waitForResponse(r => r.url().endsWith("/api/legal_moves")), square(page, from)]);
    await ready(page);
    const response = page.waitForResponse(r => r.url().endsWith("/api/move"));
    await square(page, to);
    const committed = await response;
    expect(committed.status()).toBe(200);
    await ready(page);
    return committed.json();
}
async function state(page) { return (await page.request.get("/api/state")).json(); }

test("built web: start, reload before move, two turns, decline/accept draw, lock and rematch", async ({ page, context }) => {
    const errors = [], failedAssets = [], moves = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", r => { if (r.url().includes("/assets/") && r.status() >= 400) failedAssets.push(r.url()); });
    page.on("request", r => { if (r.url().endsWith("/api/move")) moves.push(r.postDataJSON()); });
    await page.goto("/");
    await ready(page);
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await ready(page);
    const initial = await state(page);
    await page.reload();
    await ready(page);
    await expect(page.locator("#btn-start")).toBeHidden();
    expect((await state(page)).gameId).toBe(initial.gameId);
    await move(page, "a2", "a3");
    await move(page, "a8", "a7");
    expect(moves).toHaveLength(2);
    await page.getByRole("button", { name: "Đề nghị hòa", exact: true }).click();
    await ready(page);
    await page.reload();
    await ready(page);
    await expect(page.locator("#draw-response")).toBeVisible();
    await page.getByRole("button", { name: "Sơn Tinh: tiếp tục chơi", exact: true }).click();
    await ready(page);
    await page.getByRole("button", { name: "Đề nghị hòa", exact: true }).click();
    await ready(page);
    await page.getByRole("button", { name: "Sơn Tinh: đồng ý hòa", exact: true }).click();
    await ready(page);
    await expect(page.locator("#status-line")).toContainText("hai bên đồng ý hòa");
    const end = await state(page);
    const locked = await page.request.post("/api/move", { data: { from: "c2", to: "c3", gameId: end.gameId, revision: end.revision } });
    expect(locked.status()).toBe(409);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Chơi lại", exact: true }).click();
    await ready(page);
    expect((await state(page)).gameId).not.toBe(end.gameId);
    await move(page, "c2", "c3");
    await page.screenshot({ path: ".test-artifacts/ui-screenshots/web-hotseat.png" });
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
});

test("built web: separate browsers keep separate games, stale tab cannot reset or move", async ({ browser }) => {
    test.setTimeout(180000);
    const a = await browser.newContext({ baseURL: "http://127.0.0.1:4180" });
    const b = await browser.newContext({ baseURL: "http://127.0.0.1:4180" });
    const errors = [];
    for (const context of [a, b]) context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
    try {
        const first = await a.newPage(), other = await b.newPage();
        for (const page of [first, other]) {
            await page.bringToFront(); await page.goto("/"); await ready(page);
            await page.locator("#btn-start").click(); await ready(page);
        }
        const initialOther = await state(other);
        // Keep B's session, release its canvas before opening a third tab on software WebGL.
        await other.close();
        const otherState = async () => (await b.request.get("/api/state")).json();
        const stale = await a.newPage();
        await stale.goto("/"); await ready(stale);
        await move(first, "a2", "a3");
        expect(await otherState()).toEqual(initialOther);
        // An old tab cannot commit a command against a newer board.
        const old = { gameId: (await state(first)).gameId, revision: 0 };
        const rejected = await stale.request.post("/api/move", { data: { ...old, from: "a8", to: "a7" } });
        expect(rejected.status()).toBe(409);
        await stale.bringToFront();
        await stale.reload();
        await ready(stale);
        expect((await state(first)).movesPlayed).toBe(1);
        await move(stale, "a8", "a7");
        expect((await state(first)).movesPlayed).toBe(2);
        expect(await otherState()).toEqual(initialOther);
        await stale.close();
    } finally { await a.close(); await b.close(); }
    expect(errors).toEqual([]);
});

test("built mobile web: rules open/close and selected move survives resizing", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/"); await ready(page);
    await page.getByRole("button", { name: "Cách chơi", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("5×5");
    await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
    await page.locator("#btn-start").click(); await ready(page);
    await Promise.all([page.waitForResponse(r => r.url().endsWith("/api/legal_moves")), square(page, "a2")]);
    await ready(page);
    await page.setViewportSize({ width: 430, height: 900 });
    await expect.poll(async () => (await page.locator("canvas").boundingBox()).width).toBe(430);
    const response = page.waitForResponse(r => r.url().endsWith("/api/move"));
    await square(page, "a3");
    expect((await response).status()).toBe(200); await ready(page);
    const canvas = await page.locator("canvas").boundingBox();
    const controls = await page.locator("#control-bar").boundingBox();
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(controls.y);
    await page.screenshot({ path: ".test-artifacts/ui-screenshots/web-mobile.png" });
    expect(errors).toEqual([]);
});
