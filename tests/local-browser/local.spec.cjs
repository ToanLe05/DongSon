const { test, expect, workers, open, ready, rpc, state, square, move, start, resign, rematch } = require("./helpers.cjs");

test("static subdirectory: natural Tiến Cung offline, terminal lock and rematch", async ({ page, context }) => {
    await open(page); await start(page);
    await context.setOffline(true);
    for (const [a, b] of [["e1", "d2"], ["a8", "a7"], ["d2", "e3"], ["a7", "a6"],
        ["d3", "d4"], ["a6", "a5"], ["b1", "d3"], ["a5", "a4"],
        ["e3", "e5"], ["k8", "k7"], ["d3", "e4"]]) await move(page, a, b);
    expect((await state(page)).result).toBe("tien_cung_thuy_wins");
    await expect(page.locator("#status-line")).toContainText("Tiến Cung thành công");
    await rematch(page);
    await page.screenshot({ path: ".test-artifacts/ui-screenshots/local-worker-offline-rematch.png" });
});

test("local save: reload before first move, pending draw, final result and rematch", async ({ page }) => {
    test.setTimeout(300000);
    await open(page); await start(page);
    const first = await state(page);
    await page.reload(); await ready(page);
    expect(await state(page)).toEqual(first); await expect(page.locator("#btn-start")).toBeHidden();
    await move(page, "a2", "a3"); await move(page, "a8", "a7");
    await page.locator("#btn-draw").click(); await ready(page);
    await page.reload(); await ready(page);
    await expect(page.locator("#draw-response")).toBeVisible();
    await page.locator("#btn-decline-draw").click(); await ready(page);
    await page.locator("#btn-draw").click(); await ready(page);
    await page.locator("#btn-accept-draw").click(); await ready(page);
    const final = await state(page);
    expect(final.result).toBe("draw_by_agreement");
    await page.reload(); await ready(page); expect(await state(page)).toEqual(final);
    await rematch(page); await resign(page);
    expect((await state(page)).result).toBe("resignation");
});

for (const color of ["thuy", "son"]) for (const [kind, label] of [["Ngua", "Ngựa"], ["Voi", "Voi"], ["Ga", "Gà"]]) {
    test(`Python/WASM promotion ${color} ${kind}: cancel, select, reload, finish and rematch`, async ({ page }) => {
        await open(page, "promotion-" + color);
        const from = color === "thuy" ? "a8" : "a2", to = color === "thuy" ? "a9" : "a1";
        await square(page, from); await ready(page); await square(page, to);
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape"); await ready(page);
        expect((await state(page)).lastMove).toBeNull();
        await square(page, to);
        await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click(); await ready(page);
        const promoted = await state(page);
        expect(promoted.pieces.find(p => p.square === to)).toMatchObject({ type: kind, promoted: true });
        await page.reload(); await ready(page); expect(await state(page)).toEqual(promoted);
        await resign(page); await rematch(page);
    });
}

for (const [fixture, from, to, result] of [
    ["mate", "e7", "e6", "chieu_ha_son_wins"],
    ["material", "a7", "a8", "draw_insufficient_material"],
    ["stalemate", "e3", "c1", "draw_stalemate"],
]) test(`local special result: ${fixture}, terminal lock and rematch`, async ({ page }) => {
    await open(page, fixture); await move(page, from, to);
    expect((await state(page)).result).toBe(result); await rematch(page);
});

test("local repetition and 50-move claim retain rule history across reload", async ({ page }) => {
    await open(page, "repetition");
    for (let i = 0; i < 2; i++) {
        for (const [a, b] of [["a1", "a2"], ["k8", "k7"], ["a2", "a1"], ["k7", "k8"]]) await move(page, a, b);
        if (i === 0) { await page.reload(); await ready(page); }
    }
    expect((await state(page)).result).toBe("draw_threefold_repetition"); await rematch(page);
    await open(page, "fifty"); await move(page, "a1", "a2");
    await page.reload(); await ready(page);
    expect((await state(page)).halfmoveClock).toBe(100);
    await page.locator("#btn-claim-fifty").click(); await ready(page);
    expect((await state(page)).result).toBe("draw_fifty_move_rule"); await rematch(page);
});

test("local worker handles palace lock, e5 freezing and Hoán Quân", async ({ page }) => {
    await open(page, "palace");
    expect((await rpc(page, "/legal_moves", { square: "d4" })).result.some(m => m.to === "c3")).toBe(false);
    await move(page, "d4", "f6"); await resign(page); await rematch(page);
    for (const [fixture, from] of [["frozen-knight", "d3"], ["frozen-promoted-ga", "e3"]]) {
        await open(page, fixture); await move(page, from, "e5");
        await move(page, "k8", "k7");
        expect((await rpc(page, "/legal_moves", { square: "e5" })).result).toEqual([]);
        await page.reload(); await ready(page);
        expect((await state(page)).pieces.find(p => p.square === "e5").frozen).toBe(true);
    }
    await open(page, "swap");
    const before = await state(page), than = before.pieces.find(p => p.square === "e1");
    await move(page, "e1", "b1"); await page.reload(); await ready(page);
    expect((await state(page)).pieces.find(p => p.id === than.id).square).toBe("b1");
});

test("Python calculations stay in Worker while the UI heartbeat continues", async ({ page }, info) => {
    await open(page); await start(page);
    await page.evaluate(() => { window.heartbeat = 0; window.beatTimer = setInterval(() => window.heartbeat++, 5); });
    const result = await workers.get(page).evaluate(() => new Promise(resolve => {
        const post = self.postMessage, start = performance.now();
        let completed = 0;
        self.postMessage = function (data, ...args) {
            if (typeof data.id === "string" && data.id.startsWith("heartbeat-")) {
                if (++completed === 128) { self.postMessage = post; resolve({ completed, elapsed: performance.now() - start }); }
            } else post.call(self, data, ...args);
        };
        for (let i = 0; i < 128; i++) self.onmessage({ data: { type: "command", id: "heartbeat-" + i,
            endpoint: "/legal_moves", body: { square: "abcdefghk"[i % 9] + (i % 2 ? "1" : "2") } } });
    }));
    const beats = await page.evaluate(() => { clearInterval(window.beatTimer); return window.heartbeat; });
    expect(result.completed).toBe(128); expect(beats).toBeGreaterThan(5);
    await info.attach("worker-heartbeat", { body: JSON.stringify({ ...result, beats }), contentType: "application/json" });
});

test("tabs have independent games and duplicated keys cannot commit the same move twice", async ({ page, context }) => {
    await open(page); await start(page); await move(page, "a2", "a3");
    const first = await state(page);
    const other = await context.newPage();
    await open(other); expect((await state(other)).gameId).not.toBe(first.gameId);
    await start(other); await move(other, "c2", "c3");
    expect(await state(page)).toEqual(first);
    await other.close();
    const key = await page.evaluate(() => sessionStorage.getItem("dongson.tab.v1"));
    const duplicate = await context.newPage();
    await duplicate.addInitScript(key => sessionStorage.setItem("dongson.tab.v1", key), key);
    await open(duplicate);
    const body = { gameId: first.gameId, revision: first.revision, from: "a8", to: "a7" };
    const replies = await Promise.all([rpc(page, "/move", body), rpc(duplicate, "/move", body)]);
    expect(replies.filter(r => r.ok)).toHaveLength(1);
    expect(replies.find(r => !r.ok).error.code).toBe("stale_state");
    expect((await state(page)).movesPlayed).toBe(2);
    expect(await state(duplicate)).toEqual(await state(page));
    await duplicate.close();
});

test("worker failure recovers the last committed game and the next turn remains playable", async ({ page }) => {
    await open(page); await start(page); await move(page, "a2", "a3");
    const before = await state(page), worker = workers.get(page);
    const closed = new Promise(resolve => worker.once("close", resolve));
    await worker.evaluate(() => setTimeout(() => { throw new Error("intentional-worker-restart"); }, 0));
    await closed;
    await square(page, "a8"); await ready(page); await square(page, "a7"); await ready(page);
    const after = await state(page);
    expect(after.gameId).toBe(before.gameId); expect(after.movesPlayed).toBe(2);
    expect(after.lastMove).toMatchObject({ from: "a8", to: "a7" });
    await resign(page); await rematch(page);
});

test("mobile local game: help, selection resize and continuation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.getByRole("button", { name: "Cách chơi", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Luật được tính ngay trên thiết bị");
    await page.getByRole("button", { name: "Đã hiểu", exact: true }).click(); await start(page);
    await square(page, "a2"); await ready(page);
    await page.setViewportSize({ width: 430, height: 900 });
    await expect.poll(async () => (await page.locator("canvas").boundingBox()).width).toBe(430);
    await square(page, "a3"); await ready(page);
    expect((await state(page)).movesPlayed).toBe(1);
    await page.screenshot({ path: ".test-artifacts/ui-screenshots/local-worker-mobile.png" });
});

test("Python dispatch failure restarts its interpreter without losing the committed move", async ({ page }) => {
    await open(page); await start(page); await move(page, "a2", "a3");
    const before = await state(page), oldWorker = workers.get(page);
    const closed = new Promise(resolve => oldWorker.once("close", resolve));
    await oldWorker.evaluate(() => {
        const dispatch = self.onmessage;
        self.onmessage = event => {
            self.onmessage = dispatch;
            // Break one read payload, causing a real Python exception without changing the board.
            dispatch({ data: { ...event.data, body: "invalid-command-body" } });
        };
    });
    await square(page, "a8"); await closed; await ready(page);
    expect(workers.get(page)).not.toBe(oldWorker);
    expect(await state(page)).toEqual(before);
    await move(page, "a8", "a7");
    await resign(page); await rematch(page);
});
