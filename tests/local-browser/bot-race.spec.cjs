const fs = require("node:fs");
const { test, expect, workers, open, ready, rpc, state, square, start, resign, move } = require("./helpers.cjs");
const fixtures = JSON.parse(fs.readFileSync(".test-artifacts/worker-fixtures.json", "utf8"));

async function importFile(page, text) {
    const chooser = page.waitForEvent("filechooser");
    await page.locator("#btn-import-game").click();
    await (await chooser).setFiles({ name: "other-game.json", mimeType: "application/json", buffer: Buffer.from(text) });
    await page.getByRole("dialog").getByRole("button", { name: "Thay bằng ván này", exact: true }).click();
}

test("load while thinking: ignore the old bot reply and never overlap bot requests", async ({ page }) => {
    test.setTimeout(240000);
    await page.addInitScript(() => {
        window.__botStats = { active: 0, max: 0, sent: 0, delivered: 0 };
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
            constructor(...args) {
                super(...args);
                this.botIds = new Set();
                this.addEventListener("message", ({ data }) => {
                    if (data.type === "result" && this.botIds.delete(data.id)) window.__botStats.active--;
                    if (data.testHeld) setTimeout(() => window.__botStats.delivered++, 0);
                });
            }
            postMessage(message, ...args) {
                if (message.endpoint === "/ai_move") {
                    this.botIds.add(message.id);
                    window.__botStats.sent++;
                    window.__botStats.active++;
                    window.__botStats.max = Math.max(window.__botStats.max, window.__botStats.active);
                }
                return super.postMessage(message, ...args);
            }
        };
    });
    await open(page); await start(page);
    const initial = await state(page);
    const file = (await rpc(page, "/export", { gameId: initial.gameId, revision: initial.revision })).result.file;
    await resign(page);
    await page.locator('input[name="play-mode"][value="human_vs_bot"]').check();
    await page.locator('input[name="human-side"][value="son"]').check();
    const worker = workers.get(page);
    await worker.evaluate(() => {
        const send = self.postMessage, receive = self.onmessage;
        let firstBot;
        self.__heldBot = [];
        self.onmessage = event => {
            if (event.data.endpoint === "/ai_move" && firstBot === undefined) firstBot = event.data.id;
            return receive(event);
        };
        self.postMessage = function (data, ...args) {
            if (data.type === "result" && data.id === firstBot) {
                self.__heldBot.push({ ...data, testHeld: true }); return;
            }
            return send.call(self, data, ...args);
        };
        self.__releaseBot = () => { for (const result of self.__heldBot.splice(0)) send.call(self, result); };
    });
    await page.locator("#btn-rematch").click();
    await expect(page.locator("#status-line")).toHaveText("Bot đang nghĩ…");
    await expect.poll(() => worker.evaluate(() => self.__heldBot.length)).toBe(1);
    const oldBotGame = await state(page);
    await expect(page.locator("#btn-import-game")).toBeEnabled();
    await square(page, "a8"); await square(page, "a7");
    expect((await state(page)).movesPlayed).toBe(1);
    await page.screenshot({ path: ".test-artifacts/ui-screenshots/bot-thinking.png" });

    await importFile(page, file); await ready(page);
    expect((await state(page)).matchConfig.mode).toBe("human_vs_human");
    // The human can use the new board even while the old response is withheld.
    await move(page, "a2", "a3");
    await importFile(page, fixtures["bot-turn-son"].file);
    await expect(page.locator("#play-mode-label")).toContainText("Bạn: Sơn Tinh");
    const waiting = await state(page);
    expect(waiting.gameId).not.toBe(oldBotGame.gameId);
    expect(waiting.movesPlayed).toBe(0);
    expect(await page.evaluate(() => window.__botStats.sent)).toBe(1);

    await worker.evaluate(() => self.__releaseBot());
    await page.waitForFunction(() => window.__botStats.delivered === 1); await ready(page);
    const fresh = await state(page);
    expect(fresh).toMatchObject({ gameId: waiting.gameId, movesPlayed: 1, turn: "son" });
    let chosen;
    for (const piece of fresh.pieces.filter(piece => piece.color === "son")) {
        const legal = await rpc(page, "/legal_moves", { square: piece.square });
        chosen = legal.result.find(candidate => !candidate.promotion);
        if (chosen) break;
    }
    expect(chosen).toBeTruthy();
    await square(page, chosen.from); await ready(page); await square(page, chosen.to); await ready(page);
    expect(await state(page)).toMatchObject({ gameId: waiting.gameId, movesPlayed: 3, turn: "son" });
    expect(await page.evaluate(() => window.__botStats)).toEqual({ active: 0, max: 1, sent: 3, delivered: 1 });
});
