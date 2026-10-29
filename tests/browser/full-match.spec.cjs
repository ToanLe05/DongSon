const {
    test, expect, API, fixture, ready, square, move, moveCount,
    playMove, resignThroughUI, finishAndRematch, screenshot,
} = require("./helpers.cjs");

async function openScenario(page, request, scenario, options = {}) {
    const initial = await fixture(request, { kind: "scenario", scenario, ...options });
    expect(initial.gameOver, "The scenario starts before its decisive move").toBe(false);
    await page.goto("/");
    await ready(page);
    await expect(page.locator("#btn-end")).toBeEnabled();
    return initial;
}

test("standard opening reaches a natural Tien Cung win, then rematches and continues", async ({ page, request }) => {
    test.setTimeout(180000);
    await fixture(request, { kind: "standard" });
    await page.goto("/");
    await ready(page);
    await page.locator("#btn-start").click();
    await ready(page);
    const line = [
        ["e1", "d2"], ["a8", "a7"], ["d2", "e3"], ["a7", "a6"],
        ["d3", "d4"], ["a6", "a5"], ["b1", "d3"], ["a5", "a4"],
        ["e3", "e5"], ["k8", "k7"], ["d3", "e4"],
    ];
    for (const [index, [from, to]] of line.entries()) {
        const state = await playMove(page, from, to);
        expect(state.movesPlayed).toBe(index + 1);
        if (index < line.length - 1) expect(state.gameOver).toBe(false);
        else expect(state).toMatchObject({ result: "tien_cung_thuy_wins", winner: "thuy" });
    }
    expect(moveCount(page)).toBe(11);
    await screenshot(page, "standard-tien-cung");
    await finishAndRematch(page, request, "Thủy Tinh thắng — Tiến Cung thành công", "tien_cung_thuy_wins");
    await screenshot(page, "standard-rematch-first-move");
});

test("standard game captures a piece, ends by resignation, then restarts", async ({ page, request }) => {
    test.setTimeout(180000);
    await fixture(request, { kind: "standard" });
    await page.goto("/");
    await ready(page);
    await page.locator("#btn-start").click();
    await ready(page);
    let state;
    for (const [from, to] of [
        ["a2", "a3"], ["b7", "b6"], ["a3", "a4"], ["k8", "k7"],
        ["a4", "a5"], ["k7", "k6"], ["a5", "b6"],
    ]) state = await playMove(page, from, to);
    expect(state.pieces).toHaveLength(35);
    expect(state.lastMove.capture).toBe(true);
    expect(state.pieces.find(piece => piece.square === "b6")).toMatchObject({ color: "thuy", type: "Bo" });
    await resignThroughUI(page);
    await finishAndRematch(page, request, "Thủy Tinh thắng — Sơn Tinh đầu hàng", "resignation");
});

for (const mirror of [false, true]) {
    const winner = mirror ? "son" : "thuy";
    const name = mirror ? "Sơn Tinh" : "Thủy Tinh";
    test(`decisive Tien Cung move for ${winner}, terminal lock, rematch and next move`, async ({ page, request }) => {
        await openScenario(page, request, "tribute", { mirror });
        const state = await playMove(page, mirror ? "e7" : "e3", "e5");
        expect(state.winner).toBe(winner);
        await finishAndRematch(page, request, `${name} thắng — Tiến Cung thành công`, `tien_cung_${winner}_wins`);
    });
    test(`decisive checkmate for ${mirror ? "thuy" : "son"}, terminal lock and rematch`, async ({ page, request }) => {
        const mateWinner = mirror ? "thuy" : "son";
        await openScenario(page, request, "mate", { mirror });
        const state = await playMove(page, mirror ? "e3" : "e7", mirror ? "e4" : "e6");
        expect(state).toMatchObject({ winner: mateWinner, check: true, gameOver: true });
        if (!mirror) await screenshot(page, "checkmate-final");
        await finishAndRematch(page, request, "thắng — chiếu hạ", `chieu_ha_${mateWinner}_wins`);
    });
}

test("check appears, illegal non-evasion sends no move, legal evasion clears it and play continues", async ({ page, request }) => {
    await openScenario(page, request, "check");
    const checked = await playMove(page, "a4", "e4");
    expect(checked.check).toBe(true);
    await expect(page.locator("#status-line")).toContainText("đang bị chiếu");
    const count = moveCount(page);
    await move(page, "a2", "a3");
    expect(moveCount(page)).toBe(count);
    const escaped = await playMove(page, "e1", "d2");
    expect(escaped.check).toBe(false);
    expect(escaped.gameOver).toBe(false);
    await resignThroughUI(page);
    await finishAndRematch(page, request, "đầu hàng", "resignation");
});

test("attacked gift prevents Tien Cung, capture animates, match can finish and restart", async ({ page, request }) => {
    await openScenario(page, request, "tribute-blocked");
    const attempt = await playMove(page, "e3", "e5");
    expect(attempt.gameOver).toBe(false);
    await expect(page.locator("#btn-rematch")).toBeHidden();
    const capture = await playMove(page, "d8", "d4");
    expect(capture.lastMove.capture).toBe(true);
    expect(capture.pieces.find(piece => piece.square === "d4")).toMatchObject({ color: "son", type: "Lac" });
    await resignThroughUI(page);
    await finishAndRematch(page, request, "Sơn Tinh thắng", "resignation");
});

test("capturing the last non-Than piece triggers material draw, then rematch", async ({ page, request }) => {
    await openScenario(page, request, "material");
    const capture = await playMove(page, "a7", "a8");
    expect(capture.lastMove.capture).toBe(true);
    expect(capture.pieces.filter(piece => piece.color === "son")).toHaveLength(1);
    await finishAndRematch(page, request, "chỉ còn quân Thần", "draw_insufficient_material");
});

test("a played move causes stalemate, displays its reason, then rematches", async ({ page, request }) => {
    await openScenario(page, request, "stalemate");
    const state = await playMove(page, "e3", "c1");
    expect(state.check).toBe(false);
    await finishAndRematch(page, request, "bí nước", "draw_stalemate");
});

test("two real repetition cycles trigger automatic draw, then rematch and continue", async ({ page, request }) => {
    test.setTimeout(180000);
    await openScenario(page, request, "repetition");
    let state;
    for (let cycle = 0; cycle < 2; cycle++) {
        for (const [from, to] of [["a1", "a2"], ["k8", "k7"], ["a2", "a1"], ["k7", "k8"]]) {
            state = await playMove(page, from, to);
        }
        expect(state.gameOver).toBe(cycle === 1);
    }
    await finishAndRematch(page, request, "thế cờ xuất hiện ba lần", "draw_threefold_repetition");
});

test("99 becomes 100 halfmoves through the board, claim becomes available, then draw and rematch", async ({ page, request }) => {
    await openScenario(page, request, "fifty");
    await expect(page.locator("#btn-claim-fifty")).toBeHidden();
    const state = await playMove(page, "a1", "a2");
    expect(state.halfmoveClock).toBe(100);
    expect(state.gameOver).toBe(false);
    await expect(page.locator("#btn-claim-fifty")).toBeEnabled();
    await page.locator("#btn-claim-fifty").click();
    await finishAndRematch(page, request, "yêu cầu hòa 50 nước", "draw_fifty_move_rule");
});

for (const color of ["thuy", "son"]) {
    test(`Hoan Quan for ${color} swaps both identities and stays playable until rematch`, async ({ page, request }) => {
        const initial = await openScenario(page, request, "swap", { color });
        const rank = color === "son" ? "9" : "1";
        const than = initial.pieces.find(piece => piece.square === "e" + rank);
        const voi = initial.pieces.find(piece => piece.square === "b" + rank);
        const state = await playMove(page, "e" + rank, "b" + rank);
        expect(state.lastMove.isHoanQuan).toBe(true);
        expect(state.pieces.find(piece => piece.id === than.id).square).toBe("b" + rank);
        expect(state.pieces.find(piece => piece.id === voi.id).square).toBe("e" + rank);
        expect(state.pieces).toHaveLength(initial.pieces.length);
        expect(state.gameOver).toBe(false);
        if (color === "thuy") await screenshot(page, "hoan-quan-both-pieces");
        await resignThroughUI(page);
        await finishAndRematch(page, request, "đầu hàng", "resignation");
    });
}

for (const [scenario, from] of [["frozen-knight", "d3"], ["frozen-promoted-ga", "e3"]]) {
    test(`${scenario} freezes on e5, cannot move, then finishes and rematches`, async ({ page, request }) => {
        await openScenario(page, request, scenario);
        const state = await playMove(page, from, "e5");
        expect(state.pieces.find(piece => piece.square === "e5")).toMatchObject({
            color: "thuy", frozen: true, enteredPalace: true,
        });
        await playMove(page, "k8", "k7");
        const count = moveCount(page);
        await move(page, "e5", scenario === "frozen-knight" ? "d3" : "e3");
        expect(moveCount(page)).toBe(count);
        const latest = await (await request.get(API + "/state")).json();
        expect(latest.turn).toBe("thuy");
        expect(latest.pieces.find(piece => piece.square === "e5").frozen).toBe(true);
        await resignThroughUI(page);
        await finishAndRematch(page, request, "đầu hàng", "resignation");
    });
}

test("palace occupant cannot leave, can move inside, then finishes and rematches", async ({ page, request }) => {
    await openScenario(page, request, "palace");
    const count = moveCount(page);
    await move(page, "d4", "c3");
    expect(moveCount(page)).toBe(count);
    const state = await playMove(page, "d4", "f6");
    expect(state.pieces.find(piece => piece.square === "f6")).toMatchObject({ type: "Voi", enteredPalace: true });
    await resignThroughUI(page);
    await finishAndRematch(page, request, "đầu hàng", "resignation");
});
