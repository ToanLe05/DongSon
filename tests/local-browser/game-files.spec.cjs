const fs = require("node:fs");
const { test, expect, workers, open, ready, rpc, state, move, start, resign, rematch } = require("./helpers.cjs");

const version = s => ({ gameId: s.gameId, revision: s.revision });
const contents = s => { const { gameId, revision, ...rest } = s; return rest; };
async function exported(page) {
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất JSON", exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toMatch(/^CoDongSon-.*\.json$/);
    const file = fs.readFileSync(await download.path());
    await ready(page);
    return { name: download.suggestedFilename(), mimeType: "application/json", buffer: file };
}
async function choose(page, file) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Nhập JSON", exact: true }).click();
    await (await chooser).setFiles(file);
}
async function confirm(page) {
    await page.getByRole("dialog").getByRole("button", { name: "Thay bằng ván này", exact: true }).click();
    await ready(page);
}

test("JSON file: real download, cancel/confirm import, reload and continue", async ({ page }) => {
    test.setTimeout(240000);
    await open(page); await start(page);
    await move(page, "a2", "a3"); await move(page, "a8", "a7");
    const saved = await state(page), file = await exported(page);
    expect(JSON.parse(file.buffer.toString()).format).toBe("dongson-game");
    await move(page, "c2", "c3");
    const later = await state(page);
    await choose(page, file);
    await page.getByRole("dialog").getByRole("button", { name: "Giữ ván hiện tại", exact: true }).click();
    await ready(page); expect(await state(page)).toEqual(later);
    await choose(page, file); await confirm(page);
    const loaded = await state(page);
    expect(contents(loaded)).toEqual(contents(saved));
    expect(loaded.gameId).not.toBe(saved.gameId);
    const stale = await rpc(page, "/resign", version(later));
    expect(stale.error.code).toBe("stale_state");
    await page.reload(); await ready(page);
    expect(await state(page)).toEqual(loaded);
    await move(page, "c2", "c3");
    // Selecting the same file a second time still triggers a fresh import.
    await choose(page, file); await confirm(page);
    expect(contents(await state(page))).toEqual(contents(saved));
    await move(page, "c2", "c3");
    await page.screenshot({ path: ".test-artifacts/ui-screenshots/json-import-continued.png" });
});

test("browser save: pending draw and terminal result survive a new tab key", async ({ page }) => {
    test.setTimeout(240000);
    await open(page); await start(page);
    await move(page, "a2", "a3"); await move(page, "a8", "a7");
    await page.locator("#btn-draw").click(); await ready(page);
    const pending = await state(page);
    await page.getByRole("button", { name: "Lưu ván", exact: true }).click(); await ready(page);
    await expect(page.locator("#action-message")).toContainText("Đã lưu ván");
    await page.locator("#btn-decline-draw").click(); await ready(page);
    await move(page, "c2", "c3");
    await page.getByRole("button", { name: "Tải ván", exact: true }).click(); await confirm(page);
    expect(contents(await state(page))).toEqual(contents(pending));
    await page.locator("#btn-accept-draw").click(); await ready(page);
    const terminal = await state(page);
    const terminalFile = await exported(page);
    await page.locator("#btn-save-game").click(); await ready(page);
    // A different tab key has a new live game but can access the named browser save.
    await page.evaluate(() => sessionStorage.removeItem("dongson.tab.v1"));
    await page.reload(); await ready(page);
    await expect(page.locator("#btn-start")).toBeVisible();
    await page.locator("#btn-load-game").click(); await confirm(page);
    expect(contents(await state(page))).toEqual(contents(terminal));
    await rematch(page);
    await choose(page, terminalFile); await confirm(page);
    expect((await state(page)).result).toBe("draw_by_agreement");
    await rematch(page);
});

test("JSON errors leave live and stored games unchanged, including after resignation", async ({ page }) => {
    await open(page);
    await page.locator("#btn-load-game").click(); await ready(page);
    await expect(page.locator("#action-message")).toContainText("Chưa có ván được lưu");
    await start(page); await move(page, "a2", "a3");
    const before = await state(page), worker = workers.get(page);
    const valid = (await rpc(page, "/export", version(before))).result.file;
    const damaged = JSON.parse(valid);
    damaged.snapshot.game.board.board[0][4] = null;
    const files = ["not JSON", JSON.stringify({ format: "dongson-game", version: 99 }), JSON.stringify(damaged)];
    for (const text of files) {
        await choose(page, { name: "bad.json", mimeType: "application/json", buffer: Buffer.from(text) });
        await ready(page);
        await expect(page.locator("#action-message")).toContainText("Tệp JSON không hợp lệ");
        expect(await state(page)).toEqual(before);
        expect(workers.get(page)).toBe(worker);
        await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await choose(page, { name: "too-big.json", mimeType: "application/json", buffer: Buffer.alloc(16 * 1024 * 1024 + 1, 32) });
    await ready(page);
    await expect(page.locator("#action-message")).toContainText("không lớn hơn 16 MB");
    expect(await state(page)).toEqual(before);
    await resign(page);
    const ended = await state(page);
    await choose(page, { name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{}") });
    await ready(page);
    await expect(page.locator("#action-message")).toContainText("Tệp JSON không hợp lệ");
    expect(await state(page)).toEqual(ended);
});

test("JSON promotion transfer preserves piece identity and remains playable", async ({ page }) => {
    await open(page, "promotion-thuy");
    await move(page, "a8", "a9", "Ngựa");
    const promoted = await state(page), file = await exported(page);
    await resign(page);
    await choose(page, file); await confirm(page);
    expect(contents(await state(page))).toEqual(contents(promoted));
    await move(page, "h8", "h7");
    await resign(page); await rematch(page);
});

test("JSON picker retains its selected file while a visibility refresh is pending", async ({ page }) => {
    await open(page); await start(page); await move(page, "a2", "a3");
    const saved = await state(page), file = await exported(page);
    const chooserPromise = page.waitForEvent("filechooser");
    await page.locator("#btn-import-game").click();
    const chooser = await chooserPromise;
    await workers.get(page).evaluate(() => {
        const dispatch = self.onmessage;
        self.onmessage = event => {
            self.onmessage = dispatch;
            setTimeout(() => dispatch(event), 1000);
        };
    });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.locator("#canvas-root")).toHaveAttribute("aria-busy", "true");
    await chooser.setFiles(file);
    await confirm(page);
    expect(contents(await state(page))).toEqual(contents(saved));
    await move(page, "a8", "a7");
});

test("browser save protocol and aborted JSON import preserve the last committed game", async ({ page }) => {
    await open(page); await start(page); await move(page, "a2", "a3");
    const saved = await state(page);
    const file = (await rpc(page, "/export", version(saved))).result.file;
    expect((await rpc(page, "/save", { ...version(saved), slot: 2 })).ok).toBe(true);
    await move(page, "a8", "a7");
    let current = await state(page);
    const loaded = await rpc(page, "/load", { ...version(current), slot: 2 });
    expect(loaded.ok).toBe(true);
    expect(contents(loaded.result)).toEqual(contents(saved));
    await page.reload(); await ready(page);
    await move(page, "a8", "a7"); current = await state(page);
    const worker = workers.get(page);
    await worker.evaluate(() => {
        const transaction = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (...args) {
            const tx = transaction.apply(this, args);
            if (args[1] === "readwrite") {
                IDBDatabase.prototype.transaction = transaction;
                queueMicrotask(() => tx.abort());
            }
            return tx;
        };
    });
    const aborted = await rpc(page, "/import", { ...version(current), file });
    expect(aborted.error.code).toBe("storage_error");
    expect(await state(page)).toEqual(current);
    expect(workers.get(page)).toBe(worker);
    await page.reload(); await ready(page);
    expect(await state(page)).toEqual(current);
    await move(page, "c2", "c3");
});
