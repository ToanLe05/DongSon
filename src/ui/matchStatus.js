export const SIDE_NAME = { thuy: "Thủy Tinh", son: "Sơn Tinh" };
export const otherSide = side => side === "thuy" ? "son" : "thuy";
export const isGameOver = state => Boolean(state?.gameOver || state?.winner);

const DRAW_REASON = {
    draw_stalemate: "bí nước: bên đến lượt không bị chiếu nhưng không có nước đi hợp lệ",
    draw_insufficient_material: "một bên chỉ còn quân Thần",
    draw_fifty_move_rule: "đã yêu cầu hòa 50 nước, không đi Bộ/Đinh và không bắt quân",
    draw_threefold_repetition: "cùng một thế cờ xuất hiện ba lần",
    draw_by_agreement: "hai bên đồng ý hòa",
};

export function describeState(state) {
    if (!state) return "Chọn Bắt đầu để chơi.";
    if (state.winner === "draw") {
        return `Hòa — ${DRAW_REASON[state.result] ?? "ván cờ được xử hòa"}. Chọn Chơi lại để bắt đầu ván mới.`;
    }
    if (state.winner) {
        const winner = SIDE_NAME[state.winner] ?? state.winner;
        let reason = "ván cờ đã kết thúc";
        if (state.result?.startsWith("chieu_ha_")) reason = "chiếu hạ";
        if (state.result?.startsWith("tien_cung_")) reason = "Tiến Cung thành công";
        if (state.result === "resignation") reason = `${SIDE_NAME[otherSide(state.winner)]} đầu hàng`;
        return `${winner} thắng — ${reason}. Chọn Chơi lại để bắt đầu ván mới.`;
    }
    if (state.drawOfferPending) {
        return `${SIDE_NAME[state.drawOfferPending]} đề nghị hòa. ${SIDE_NAME[otherSide(state.drawOfferPending)]} quyết định đồng ý hoặc tiếp tục chơi.`;
    }
    const turn = SIDE_NAME[state.turn] ?? state.turn;
    return `Đến lượt ${turn}${state.check ? " — đang bị chiếu!" : "."}${
        state.canClaimFiftyMoveDraw ? " Có thể yêu cầu hòa theo luật 50 nước." : ""
    }`;
}
