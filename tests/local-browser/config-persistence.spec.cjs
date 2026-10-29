const fs = require("node:fs");
const { test, expect, open, ready, rpc, state, square, resign } = require("./helpers.cjs");

for (const side of ["thuy", "son"]) test(`controller config ${side}: real JSON, reload and named save restore ownership`, async ({ page }) => {
    test.setTimeout(300000);
    const config = { mode: "human_vs_bot", humanColor: side, botId: "random" };
    await open(page);
    await page.locator('input[name="play-mode"][value="human_vs_bot"]').check();
    await page.locator(`input[name="human-side"][value="${side}"]`).check();
    await page.locator("#btn-start").click(); await ready(page);
    const saved = await state(page);
    expect(saved.matchConfig).toEqual(config);
    await page.locator("#btn-save-game").click(); await ready(page);
    const pendingDownload = page.waitForEvent("download");
    await page.locator("#btn-export-game").click();
    const download = await pendingDownload;
    const buffer = fs.readFileSync(await download.path()); await ready(page);
    expect(JSON.parse(buffer).snapshot.matchConfig).toEqual(config);
    await resign(page);
    await page.locator('input[name="play-mode"][value="human_vs_human"]').check();
    await page.locator("#btn-rematch").click(); await ready(page);
    expect((await state(page)).matchConfig.mode).toBe("human_vs_human");

    const chooser = page.waitForEvent("filechooser");
    await page.locator("#btn-import-game").click();
    await (await chooser).setFiles({ name: "bot-game.json", mimeType: "application/json", buffer });
    await page.getByRole("dialog").getByRole("button", { name: "Thay bằng ván này", exact: true }).click(); await ready(page);
    const loaded = await state(page);
    expect(loaded.matchConfig).toEqual(config);
    expect(loaded.turn).toBe(side);
    expect(loaded.movesPlayed).toBe(saved.movesPlayed);
    await page.reload(); await ready(page);
    expect(await state(page)).toEqual(loaded);
    await expect(page.locator("#play-mode-label")).toContainText(side === "thuy" ? "Bạn: Thủy Tinh" : "Bạn: Sơn Tinh");

    let chosen;
    for (const piece of loaded.pieces.filter(p => p.color === side)) {
        const response = await rpc(page, "/legal_moves", { square: piece.square });
        chosen = response.result.find(move => !move.promotion);
        if (chosen) break;
    }
    expect(chosen).toBeTruthy();
    await square(page, chosen.from); await ready(page); await square(page, chosen.to); await ready(page);
    expect(await state(page)).toMatchObject({ turn: side, movesPlayed: saved.movesPlayed + 2, matchConfig: config });

    await page.evaluate(() => sessionStorage.removeItem("dongson.tab.v1"));
    await page.reload(); await ready(page);
    await expect(page.locator("#btn-start")).toBeVisible();
    await page.locator("#btn-load-game").click();
    await page.getByRole("dialog").getByRole("button", { name: "Thay bằng ván này", exact: true }).click(); await ready(page);
    expect(await state(page)).toMatchObject({ turn: side, movesPlayed: saved.movesPlayed, matchConfig: config });
});
