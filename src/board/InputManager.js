export default class InputManager {
    constructor(board) {
        this.board = board;
        this.enabled = false;
        this.busy = false;
        this.revision = 0;
        this.selectedSquare = null;
        this.legalMoves = [];
    }
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.board.on("cell-click", this.handleClick, this);
        this.board.on("cell-hover", this.handleHover, this);
    }
    disable() {
        this.enabled = false;
        this.board.off("cell-click", this.handleClick, this);
        this.board.off("cell-hover", this.handleHover, this);
        this.board.cancelPromotionDialog();
        this.clearSelection();
    }
    destroy() { this.disable(); }
    handleHover(square) {
        if (this.enabled && !this.busy) this.onHover?.(square);
    }
    async handleClick(square) {
        if (!this.enabled || this.busy) return;
        this.busy = true;
        this.board.emit("input-busy", true);
        try {
            if (square === this.selectedSquare) return this.clearSelection();
            const candidates = this.legalMoves.filter(move => move.to === square);
            if (candidates.length) {
                let move = candidates[0];
                if (candidates.some(candidate => candidate.promotion)) {
                    const revision = this.revision;
                    const promotion = await this.board.showPromotionDialog(candidates);
                    if (!this.enabled || revision !== this.revision || !promotion) return;
                    move = candidates.find(candidate => candidate.promotion === promotion);
                }
                if (move) await this.makeMove(move);
            } else {
                await this.selectPiece(square);
            }
        } catch (error) {
            this.clearSelection();
            this.board.emit("input-error", error);
        } finally {
            this.busy = false;
            this.board.emit("input-busy", false);
        }
    }
    async selectPiece(square) {
        this.clearSelection();
        if (!this.onRequestLegalMoves) return;
        const revision = this.revision;
        const moves = await this.onRequestLegalMoves(square);
        if (!this.enabled || revision !== this.revision || !moves?.length) return;
        this.selectedSquare = square;
        this.legalMoves = moves;
        this.board.selectSquare(square);
        this.board.showLegalMoves(moves);
    }
    async makeMove(move) {
        if (!this.onRequestMove) return;
        try { await this.onRequestMove(move); }
        finally { this.clearSelection(); }
    }
    clearSelection() {
        this.revision++;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.board.clearSelection();
        this.board.clearLegalMoves();
    }
    setMoveProvider(fn) { this.onRequestMove = fn; }
    setLegalMoveProvider(fn) { this.onRequestLegalMoves = fn; }
    setHoverProvider(fn) { this.onHover = fn; }
}
