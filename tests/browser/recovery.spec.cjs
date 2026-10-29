const {
    test, expect, API, fixture, ready, move, playMove, resignThroughUI, finishAndRematch,
} = require("./helpers.cjs");

test("stale-move warning clears after a successful retry, then match finishes and rematches", async ({ page, request }) => {
    await fixture(request, { kind: "standard" });
    await page.goto("/");
    await ready(page);
    await page.locator("#btn-start").click();
    await ready(page);
    await request.post(API + "/new_game");
    await move(page, "a2", "a3");
    await expect(page.locator("#action-message")).toContainText("Thế cờ đã thay đổi");
    await ready(page);
    const retry = await playMove(page, "a2", "a3");
    expect(retry.movesPlayed).toBe(1);
    await expect(page.locator("#action-message"), "A successful move must clear an obsolete error").toHaveText("");
    await resignThroughUI(page);
    await finishAndRematch(page, request, "đầu hàng", "resignation");
});
