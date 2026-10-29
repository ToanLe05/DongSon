const {
    test, expect, API, fixture, ready, move, square, moveCount,
    playMove, resignThroughUI, finishAndRematch, screenshot,
} = require("./helpers.cjs");

test("capture-promotion can be cancelled, commits once, moves as its new type, then rematches", async ({ page, request }) => {
    const initial = await fixture(request, { kind: "promotion", color: "thuy", piece: "Bo", capture: true });
    const victim = initial.pieces.find(piece => piece.square === "b9");
    await page.goto("/");
    await ready(page);
    await move(page, "a8", "b9");
    await page.getByRole("dialog").getByRole("button", { name: "Hủy", exact: true }).click();
    await ready(page);
    expect(moveCount(page)).toBe(0);
    const cancelled = await (await request.get(API + "/state")).json();
    expect(cancelled.pieces).toEqual(initial.pieces);
    expect(cancelled.turn).toBe("thuy");
    // Deselect explicitly, then select the source again as a fresh board action.
    await square(page, "a8");
    await ready(page);
    const promoted = await playMove(page, "a8", "b9", "Voi");
    expect(promoted.lastMove).toMatchObject({ capture: true, promotion: "Voi" });
    expect(promoted.pieces).toHaveLength(initial.pieces.length - 1);
    expect(promoted.pieces.some(piece => piece.id === victim.id)).toBe(false);
    expect(promoted.pieces.find(piece => piece.square === "b9")).toMatchObject({
        type: "Voi", color: "thuy", promoted: true,
    });
    await screenshot(page, "capture-promotion-voi");
    await playMove(page, "k8", "k7");
    const continued = await playMove(page, "b9", "d7");
    expect(continued.pieces.find(piece => piece.square === "d7").type).toBe("Voi");
    await resignThroughUI(page);
    await finishAndRematch(page, request, "đầu hàng", "resignation");
});
