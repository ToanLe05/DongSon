const { test: base, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const API = "http://127.0.0.1:8001";
const commands = new WeakMap();

const test = base.extend({
    uiErrors: [async ({ page }, use, info) => {
        const errors = [];
        const log = [];
        commands.set(page, log);
        page.on("pageerror", error => errors.push(error.message));
        page.on("request", request => {
            if (request.method() === "POST" && request.url().startsWith(API)) {
                log.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() });
            }
        });
        await use();
        await info.attach("browser-commands", {
            body: JSON.stringify({ commands: log, uncaughtErrors: errors }, null, 2),
            contentType: "application/json",
        });
        expect(errors, "No uncaught browser errors during any complete match").toEqual([]);
    }, { auto: true }],
});

async function fixture(request, data) {
    const response = await request.post(API + "/__test__/position", { data });
    expect(response.ok()).toBeTruthy();
    const state = await response.json();
    await test.info().attach("initial-position", {
        body: JSON.stringify({ setup: data, state }, null, 2),
        contentType: "application/json",
    });
    return state;
}
async function ready(page) {
    await expect(page.locator("#canvas-root")).toHaveAttribute("aria-busy", "false");
}
async function square(page, name) {
    const box = await page.locator("canvas").boundingBox();
    const cell = Math.floor(Math.max(28 * 9, Math.min(box.width, box.height) - 96) / 9);
    const col = "abcdefghk".indexOf(name[0]), row = Number(name.slice(1)) - 1;
    await page.mouse.click(box.x + (box.width - cell * 9) / 2 + (col + 0.5) * cell,
        box.y + (box.height - cell * 9) / 2 + (8 - row + 0.5) * cell);
}
async function move(page, from, to) {
    await Promise.all([
        page.waitForResponse(response => response.url() === API + "/legal_moves"),
        square(page, from),
    ]);
    await ready(page);
    await square(page, to);
    await expect(page.locator("#canvas-root[aria-busy=\"false\"], dialog[open]")).toBeVisible();
}
function moveCount(page) {
    return (commands.get(page) ?? []).filter(command => command.path === "/move").length;
}
async function playMove(page, from, to, promotion) {
    return test.step(`UI move ${from} → ${to}${promotion ? " = " + promotion : ""}`, async () => {
        const before = moveCount(page);
        const responsePromise = page.waitForResponse(response => response.url() === API + "/move");
        await move(page, from, to);
        if (promotion) {
            await page.getByRole("dialog").getByRole("button", { name: promotion, exact: true }).click();
        }
        const response = await responsePromise;
        expect(response.status()).toBe(200);
        const state = await response.json();
        await ready(page);
        expect(state.lastMove).toMatchObject({ from, to });
        expect(moveCount(page), "Each board action submits one move").toBe(before + 1);
        return state;
    });
}
async function resignThroughUI(page) {
    await expect(page.locator("#btn-end")).toBeEnabled();
    await page.locator("#btn-end").click();
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận đầu hàng", exact: true }).click();
    await ready(page);
}
async function screenshot(page, name) {
    const folder = path.resolve(".test-artifacts", "ui-screenshots");
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, name + ".png");
    await page.screenshot({ path: file, fullPage: true });
    await test.info().attach(name, { path: file, contentType: "image/png" });
}
async function finishAndRematch(page, request, reason, result) {
    return test.step("Verify final result, locked board, rematch and first new move", async () => {
        await expect(page.locator("#status-line")).toContainText(reason);
        await expect(page.locator("#btn-rematch")).toBeEnabled();
        await ready(page);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.locator("#btn-end")).toBeHidden();
        await expect(page.locator("#btn-draw")).toBeHidden();
        const finalState = await (await request.get(API + "/state")).json();
        expect(finalState.gameOver).toBe(true);
        if (result) expect(finalState.result).toBe(result);
        const count = moveCount(page);
        await square(page, "a2");
        await square(page, "a3");
        expect(moveCount(page), "Board cannot submit after the result").toBe(count);
        const blocked = await request.post(API + "/move", { data: { from: "a2", to: "a3" } });
        expect(blocked.status()).toBe(409);
        expect(await (await request.get(API + "/state")).json()).toEqual(finalState);
        const [response] = await Promise.all([
            page.waitForResponse(response => response.url() === API + "/new_game"),
            page.locator("#btn-rematch").click(),
        ]);
        expect(response.status()).toBe(200);
        const fresh = await response.json();
        await ready(page);
        expect(fresh.gameId).not.toBe(finalState.gameId);
        expect(fresh).toMatchObject({
            movesPlayed: 0, halfmoveClock: 0, turn: "thuy", result: "ongoing",
            winner: null, gameOver: false, lastMove: null, drawOfferPending: null,
        });
        expect(fresh.pieces).toHaveLength(36);
        await expect(page.locator("#status-line")).toHaveText("Đến lượt Thủy Tinh.");
        await expect(page.locator("#action-message")).toHaveText("");
        const firstMove = await playMove(page, "a2", "a3");
        expect(firstMove.movesPlayed).toBe(1);
        expect(firstMove.turn).toBe("son");
        return firstMove;
    });
}

module.exports = {
    test, expect, API, fixture, ready, square, move, moveCount,
    playMove, resignThroughUI, finishAndRematch, screenshot,
};
