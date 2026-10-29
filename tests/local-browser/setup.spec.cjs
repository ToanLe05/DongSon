const { test, expect, open, ready, rpc, state, square, resign } = require("./helpers.cjs");

async function humanMove(page) {
    const before = await state(page);
    for (const piece of before.pieces.filter(p => p.color === before.turn)) {
        const response = await rpc(page, "/legal_moves", { square: piece.square });
        const move = response.result.find(m => !m.promotion);
        if (!move) continue;
        await square(page, move.from); await ready(page); await square(page, move.to); await ready(page);
        return state(page);
    }
    throw new Error("No ordinary human move in test position");
}

test("setup: two people keep manual alternating turns", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { name: "Chọn cách chơi" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Hai người", exact: false })).toBeChecked();
    await expect(page.locator("#side-options")).toBeHidden();
    await page.getByRole("button", { name: "Bắt đầu trận đấu", exact: true }).click(); await ready(page);
    await expect(page.locator("#match-setup")).toBeHidden();
    expect((await state(page)).movesPlayed).toBe(0);
    expect((await humanMove(page)).movesPlayed).toBe(1);
    expect((await state(page)).turn).toBe("son");
    expect((await humanMove(page)).movesPlayed).toBe(2);
    await resign(page);
    await expect(page.locator("#match-setup")).toBeVisible();
});

test("setup: human Thuy starts, bot replies once, draw and mode survive reload", async ({ page }) => {
    await open(page);
    await page.locator('input[name="play-mode"][value="human_vs_bot"]').check();
    await expect(page.locator("#side-options")).toBeVisible();
    await page.locator("#btn-start").click(); await ready(page);
    expect((await state(page)).movesPlayed).toBe(0);
    await expect(page.locator("#play-mode-label")).toContainText("Bạn: Thủy Tinh");
    expect((await humanMove(page)).movesPlayed).toBe(2);
    expect((await state(page)).turn).toBe("thuy");
    await page.reload(); await ready(page);
    expect((await state(page)).movesPlayed).toBe(2);
    await expect(page.locator("#play-mode-label")).toContainText("Chơi với bot");
    await page.locator("#btn-draw").click(); await ready(page);
    expect((await state(page)).result).toBe("draw_by_agreement");
    expect((await state(page)).movesPlayed).toBe(2);
});

test("setup: human Son receives exactly one opening bot move, reload and switch to PvP", async ({ page }) => {
    await open(page);
    await page.locator('input[name="play-mode"][value="human_vs_bot"]').check();
    await page.locator('input[name="human-side"][value="son"]').check();
    await page.locator("#btn-start").evaluate(button => { button.click(); button.click(); }); await ready(page);
    const first = await state(page);
    expect(first).toMatchObject({ movesPlayed: 1, turn: "son", matchConfig: { mode: "human_vs_bot", humanColor: "son", botId: "random" } });
    expect(first.lastMove.color).toBe("thuy");
    await page.reload(); await ready(page);
    expect(await state(page)).toEqual(first);
    expect((await humanMove(page)).movesPlayed).toBe(3);
    await page.evaluate(() => { for (let i = 0; i < 5; i++) document.dispatchEvent(new Event("visibilitychange")); });
    await ready(page);
    expect((await state(page)).movesPlayed).toBe(3);
    await resign(page);
    await page.locator('input[name="play-mode"][value="human_vs_human"]').check();
    await page.locator("#btn-rematch").click(); await ready(page);
    expect(await state(page)).toMatchObject({ movesPlayed: 0, turn: "thuy", matchConfig: { mode: "human_vs_human", humanColor: null, botId: null } });
    await page.screenshot({ path: ".test-artifacts/ui-screenshots/setup-rematch.png" });
});

test("setup: narrow screen keeps mode, side and start reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.locator('input[name="play-mode"][value="human_vs_bot"]').check();
    await page.locator('input[name="human-side"][value="son"]').check();
    await expect(page.locator("#btn-start")).toBeInViewport();
    await page.screenshot({ path: ".test-artifacts/ui-screenshots/setup-mobile.png" });
    await page.locator("#btn-start").click(); await ready(page);
    expect(await state(page)).toMatchObject({ movesPlayed: 1, turn: "son" });
});
