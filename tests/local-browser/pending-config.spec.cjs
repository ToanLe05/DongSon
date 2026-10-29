const fs = require("node:fs");
const { test, expect, open, ready, state, rpc, resign } = require("./helpers.cjs");
const fixtures = JSON.parse(fs.readFileSync(".test-artifacts/worker-fixtures.json", "utf8"));

test("imported bot turn: version guards, durable bot action and terminal lock", async ({ page }) => {
    test.setTimeout(240000);
    await open(page);
    for (const side of ["thuy", "son"]) {
        const file = fixtures["bot-turn-" + side];
        const chooser = page.waitForEvent("filechooser");
        await page.locator("#btn-import-game").click();
        await (await chooser).setFiles({ name: "pending-bot.json", mimeType: "application/json", buffer: Buffer.from(file.file) });
        await expect(page.getByRole("dialog")).toContainText(side === "thuy" ? "Bạn cầm Thủy Tinh" : "Bạn cầm Sơn Tinh");
        await page.getByRole("dialog").getByRole("button", { name: "Thay bằng ván này", exact: true }).click(); await ready(page);
        const resumed = await state(page);
        expect(resumed).toMatchObject({ turn: side, movesPlayed: file.state.movesPlayed + 1,
            matchConfig: { mode: "human_vs_bot", humanColor: side, botId: "random" } });
        expect(resumed.lastMove.color).not.toBe(side);
        const stale = await rpc(page, "/ai_move", { gameId: resumed.gameId, revision: resumed.revision - 1 });
        expect(stale.error.code).toBe("stale_state");
        expect(stale.error.state).toEqual(resumed);
        const humanTurn = await rpc(page, "/ai_move", { gameId: resumed.gameId, revision: resumed.revision });
        expect(humanTurn.error.code).toBe("human_turn");
        expect(await state(page)).toEqual(resumed);
        await page.reload(); await ready(page);
        expect(await state(page)).toEqual(resumed);
    }
    await resign(page);
    const terminal = await state(page);
    const rejected = await rpc(page, "/ai_move", { gameId: terminal.gameId, revision: terminal.revision });
    expect(rejected.error.code).toBe("game_over");
    await page.reload(); await ready(page);
    expect(await state(page)).toEqual(terminal);
});
