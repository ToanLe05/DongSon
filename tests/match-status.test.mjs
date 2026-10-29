import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/ui/matchStatus.js", import.meta.url), "utf8");
const { describeState, isGameOver } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("every terminal result explains its specific reason", () => {
    const cases = [
        ["chieu_ha_thuy_wins", "thuy", "Thủy Tinh thắng — chiếu hạ"],
        ["chieu_ha_son_wins", "son", "Sơn Tinh thắng — chiếu hạ"],
        ["tien_cung_thuy_wins", "thuy", "Tiến Cung thành công"],
        ["tien_cung_son_wins", "son", "Tiến Cung thành công"],
        ["resignation", "son", "Thủy Tinh đầu hàng"],
        ["resignation", "thuy", "Sơn Tinh đầu hàng"],
        ["draw_stalemate", "draw", "bí nước"],
        ["draw_insufficient_material", "draw", "chỉ còn quân Thần"],
        ["draw_fifty_move_rule", "draw", "yêu cầu hòa 50 nước"],
        ["draw_threefold_repetition", "draw", "thế cờ xuất hiện ba lần"],
        ["draw_by_agreement", "draw", "hai bên đồng ý hòa"],
    ];
    for (const [result, winner, reason] of cases) {
        const state = { result, winner };
        assert.ok(describeState(state).includes(reason), result);
        assert.ok(describeState(state).includes("Chơi lại"));
        assert.equal(isGameOver(state), true);
    }
});

test("pending offer, check and claim eligibility remain distinct from a final draw", () => {
    const pending = { turn: "thuy", drawOfferPending: "thuy" };
    assert.equal(isGameOver(pending), false);
    assert.ok(describeState(pending).includes("Sơn Tinh quyết định"));
    assert.ok(describeState({ turn: "son", check: true }).includes("đang bị chiếu"));
    assert.ok(describeState({ turn: "thuy", canClaimFiftyMoveDraw: true }).includes("Có thể yêu cầu"));
});
