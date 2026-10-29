const { test, expect, workers, open, ready, state, square, rpc, resign } = require("./helpers.cjs");

async function hookBot(page, behavior) {
    const worker = workers.get(page);
    await worker.evaluate(behavior => {
        const send = self.postMessage, receive = self.onmessage;
        let first, newGame;
        self.__botCalls = 0; self.__held = [];
        self.onmessage = event => {
            if (event.data.endpoint === "/new_game") newGame = event.data.id;
            if (event.data.endpoint === "/ai_move") {
                self.__botCalls++;
                if (self.__botCalls === 1) {
                    first = event.data.id;
                    if (behavior === "error") {
                        send.call(self, { type: "result", id: first, ok: false,
                            error: { code: "bot_error", status: 503, message: "Bot gặp lỗi khi chọn nước. Hãy thử lại.", state: self.__baseline } });
                        return;
                    }
                }
            }
            return receive(event);
        };
        self.postMessage = function (data, ...args) {
            if (data.id === newGame && data.ok) self.__baseline = structuredClone(data.result);
            if (behavior === "hold" && data.id === first && data.type === "result") {
                self.__held.push({ ...data, testOldBot: true }); return;
            }
            return send.call(self, data, ...args);
        };
        self.__release = () => { for (const reply of self.__held.splice(0)) send.call(self, reply); };
    }, behavior);
    return worker;
}

for (const color of ["thuy", "son"]) test(`bot ${color} captures and promotes through the agent without a human dialog`, async ({ page }) => {
    await open(page, "bot-promotion-capture-" + color);
    const after = await state(page), target = color === "thuy" ? "b9" : "h1";
    expect(after.movesPlayed).toBe(1);
    expect(after.lastMove).toMatchObject({ capture: true, color, to: target });
    expect(["Ngua", "Voi", "Ga"]).toContain(after.lastMove.promotion);
    expect(after.pieces.find(piece => piece.square === target)).toMatchObject({ color, promoted: true });
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await square(page, target); await ready(page);
    expect(await state(page)).toEqual(after);
    const rejected = await rpc(page, "/ai_move", { gameId: after.gameId, revision: after.revision });
    expect(rejected.error.code).toBe("human_turn");
    await page.reload(); await ready(page); expect(await state(page)).toEqual(after);
    await resign(page); expect((await state(page)).winner).toBe(color);
});

test("bot error keeps the board and version unchanged, with a manual retry", async ({ page }) => {
    await open(page);
    const worker = await hookBot(page, "error");
    await page.locator('input[name="play-mode"][value="human_vs_bot"]').check();
    await page.locator('input[name="human-side"][value="son"]').check();
    await page.locator("#btn-start").click(); await ready(page);
    await expect(page.locator("#btn-retry-bot")).toBeVisible();
    const baseline = await worker.evaluate(() => self.__baseline);
    expect(await state(page)).toEqual(baseline);
    expect(await worker.evaluate(() => self.__botCalls)).toBe(1);
    await expect(page.locator("#action-message")).toContainText("Bot gặp lỗi");
    await page.locator("#btn-retry-bot").click(); await ready(page);
    expect(await state(page)).toMatchObject({ gameId: baseline.gameId, revision: 1, movesPlayed: 1, turn: "son" });
    expect(await worker.evaluate(() => self.__botCalls)).toBe(2);
});

test("resign while the bot reply is delayed applies to the human; rematch keeps or changes selection", async ({ page }) => {
    test.setTimeout(240000);
    await page.addInitScript(() => {
        window.__oldBotDelivered = false;
        const Native = window.Worker;
        window.Worker = class extends Native {
            constructor(...args) { super(...args); this.addEventListener("message", ({ data }) => {
                if (data.testOldBot) setTimeout(() => window.__oldBotDelivered = true, 0);
            }); }
        };
    });
    await open(page);
    const worker = await hookBot(page, "hold");
    await page.locator('input[name="play-mode"][value="human_vs_bot"]').check();
    await page.locator('input[name="human-side"][value="son"]').check();
    await page.locator("#btn-start").click();
    await expect.poll(() => worker.evaluate(() => self.__held.length)).toBe(1);
    await expect(page.locator("#btn-end")).toBeEnabled();
    await page.locator("#btn-end").click();
    await expect(page.getByRole("dialog")).toHaveAttribute("aria-label", "Sơn Tinh xác nhận đầu hàng?");
    await page.getByRole("button", { name: "Xác nhận đầu hàng", exact: true }).click(); await ready(page);
    const terminal = await state(page);
    expect(terminal).toMatchObject({ winner: "thuy", result: "resignation", gameOver: true });
    await worker.evaluate(() => self.__release());
    await page.waitForFunction(() => window.__oldBotDelivered);
    await expect(page.locator("#btn-rematch")).toBeVisible();
    expect(await state(page)).toEqual(terminal);
    await expect(page.locator('input[name="play-mode"][value="human_vs_bot"]')).toBeChecked();
    await expect(page.locator('input[name="human-side"][value="son"]')).toBeChecked();
    await page.locator("#btn-rematch").click(); await ready(page);
    expect(await state(page)).toMatchObject({ turn: "son", movesPlayed: 1, matchConfig: { humanColor: "son" } });
    await resign(page);
    await page.locator('input[name="play-mode"][value="human_vs_human"]').check();
    await page.locator("#btn-rematch").click(); await ready(page);
    expect(await state(page)).toMatchObject({ turn: "thuy", movesPlayed: 0, matchConfig: { mode: "human_vs_human" } });
});
