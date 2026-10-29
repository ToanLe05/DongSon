const { test, expect, API, fixture, ready, square, move, playMove, resignThroughUI, finishAndRematch } = require("./helpers.cjs");

test("two players offer, decline, accept, see the reason, and rematch repeatedly", async ({ page, request }) => {
    // Three full matches share one page; software-rendered Chromium needs a larger total budget.
    test.setTimeout(180000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await fixture(request, { kind: "standard" });
    await page.goto("/");
    await ready(page);
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await ready(page);
    for (let game = 0; game < 3; game++) {
        await expect(page.locator("#btn-draw")).toBeDisabled();
        await move(page, "a2", "a3");
        await expect(page.locator("#status-line")).toContainText("Sơn Tinh");
        await expect(page.locator("#btn-draw")).toBeDisabled();
        await move(page, "a8", "a7");
        await expect(page.locator("#btn-draw")).toBeEnabled();
        await page.locator("#btn-draw").click();
        await expect(page.locator("#btn-accept-draw")).toHaveText("Sơn Tinh: đồng ý hòa");
        await expect(page.locator("#btn-accept-draw")).toBeEnabled();
        await page.locator("#btn-decline-draw").click();
        await expect(page.locator("#draw-response")).toBeHidden();
        await page.locator("#btn-draw").click();
        await expect(page.locator("#btn-accept-draw")).toBeEnabled();
        await page.locator("#btn-accept-draw").click();
        await expect(page.locator("#status-line")).toContainText("hai bên đồng ý hòa");
        await expect(page.locator("#btn-rematch")).toBeEnabled();
        const finalState = await (await request.get(API + "/state")).json();
        const rejected = await request.post(API + "/undo");
        expect(rejected.status()).toBe(409);
        expect(await (await request.get(API + "/state")).json()).toEqual(finalState);
        await page.locator("#btn-rematch").click();
        await ready(page);
        await expect(page.locator("#status-line")).toHaveText("Đến lượt Thủy Tinh.");
    }
    expect(errors).toEqual([]);
});

for (const color of ["thuy", "son"]) {
    for (const [type, label] of [["Ngua", "Ngựa"], ["Voi", "Voi"], ["Ga", "Gà"]]) {
        test(`${color} chooses ${type}, can cancel, and submits exactly one promotion`, async ({ page, request }) => {
            await fixture(request, { kind: "promotion", color, piece: type === "Ga" ? "Dinh" : "Bo" });
            await page.goto("/");
            await ready(page);
            const from = color === "thuy" ? "a8" : "a2";
            const to = color === "thuy" ? "a9" : "a1";
            let submitted = 0;
            page.on("request", request => { if (request.url().endsWith("/move")) submitted++; });
            await move(page, from, to);
            await expect(page.getByRole("dialog")).toBeVisible();
            await expect(page.locator("#btn-draw")).toBeDisabled();
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await ready(page);
            expect(submitted).toBe(0);
            const before = await (await request.get(API + "/state")).json();
            expect(before.turn).toBe(color);
            expect(before.pieces.find(piece => piece.square === from).promoted).toBe(false);
            // Cancellation preserves selection; clicking the same destination opens again.
            await square(page, to);
            await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await ready(page);
            const after = await (await request.get(API + "/state")).json();
            const promoted = after.pieces.find(piece => piece.square === to);
            expect(promoted.type).toBe(type);
            expect(promoted.promoted).toBe(true);
            expect(after.turn).not.toBe(color);
            expect(submitted).toBe(1);
            if (color === "thuy") await playMove(page, "k8", "k7");
            else await playMove(page, "k2", "k3");
            const destination = color === "thuy"
                ? ({ Ngua: "b7", Voi: "c7", Ga: "c9" })[type]
                : ({ Ngua: "b3", Voi: "c3", Ga: "c1" })[type];
            const continued = await playMove(page, to, destination);
            expect(continued.pieces.find(piece => piece.square === destination)).toMatchObject({
                color, type, promoted: true,
            });
            await resignThroughUI(page);
            await finishAndRematch(page, request, "đầu hàng", "resignation");
        });
    }
}

test("fifty-move claim, resignation confirmation and small-screen layout", async ({ page, request }) => {
    await fixture(request, { kind: "fifty" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("#btn-claim-fifty")).toBeEnabled();
    await page.locator("#btn-claim-fifty").click();
    await expect(page.locator("#status-line")).toContainText("yêu cầu hòa 50 nước");
    await expect(page.locator("#btn-rematch")).toBeEnabled();
    const canvas = await page.locator("canvas").boundingBox();
    const bar = await page.locator("#control-bar").boundingBox();
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(bar.y);
    await page.locator("#btn-rematch").click();
    await ready(page);
    await page.locator("#btn-end").click();
    await expect(page.getByRole("dialog")).toContainText("Thủy Tinh xác nhận đầu hàng");
    await page.getByRole("button", { name: "Tiếp tục ván cờ", exact: true }).click();
    await expect(page.locator("#btn-end")).toBeEnabled();
    expect((await (await request.get(API + "/state")).json()).gameOver).toBe(false);
    await page.locator("#btn-end").click();
    await page.getByRole("button", { name: "Xác nhận đầu hàng", exact: true }).click();
    await expect(page.locator("#status-line")).toContainText("Sơn Tinh thắng — Thủy Tinh đầu hàng");
    await expect(page.locator("#btn-rematch")).toBeEnabled();
    // Reload retains the server's terminal result.
    await page.reload();
    await expect(page.locator("#status-line")).toContainText("Thủy Tinh đầu hàng");
});

for (const [name, reason] of [["tribute-safe", "Tiến Cung thành công"], ["bare-one", "chỉ còn quân Thần"], ["stalemate", "bí nước"]]) {
    test(`terminal reason: ${name}`, async ({ page, request }) => {
        await fixture(request, { kind: "terminal", case: name });
        await page.goto("/");
        await expect(page.locator("#status-line")).toContainText(reason);
        await expect(page.locator("#btn-rematch")).toBeEnabled();
        await expect(page.locator("#btn-end")).toBeHidden();
    });
}

test("a stale page resynchronizes and the next move remains playable", async ({ page, request }) => {
    await fixture(request, { kind: "standard" });
    await page.goto("/");
    await ready(page);
    await page.locator("#btn-start").click();
    await ready(page);
    // A second screen starts a new game while this screen still holds the old ID.
    await request.post(API + "/new_game");
    await move(page, "a2", "a3");
    await expect(page.locator("#action-message")).toContainText("Thế cờ đã thay đổi");
    await ready(page);
    const state = await (await request.get(API + "/state")).json();
    expect(state.movesPlayed).toBe(0);
    expect(state.turn).toBe("thuy");
    await move(page, "a2", "a3");
    await expect(page.locator("#status-line")).toContainText("Đến lượt Sơn Tinh");
    expect((await (await request.get(API + "/state")).json()).movesPlayed).toBe(1);
});
