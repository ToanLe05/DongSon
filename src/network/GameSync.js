export default class GameSync {
    constructor(board, api) {
        this.board = board;
        this.api = api;
        this.state = null;
        this.busy = false;
        this.listeners = new Map();
    }
    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event).add(callback);
        return () => this.listeners.get(event)?.delete(callback);
    }
    emit(event, data) {
        for (const callback of this.listeners.get(event) ?? []) callback(data);
    }
    context() {
        return { gameId: this.state?.gameId, revision: this.state?.revision };
    }
    async perform(request, { animate = false, reset = false, event = "change" } = {}) {
        if (this.busy) return;
        this.busy = true;
        this.emit("busy", true);
        try {
            const response = await request();
            const state = response.state ?? response;
            if (reset) this.board.resetBoard();
            try {
                if (animate) await this.animateTransition(this.state, state);
            } finally {
                // The server's committed state must survive rendering failures.
                await this.applyState(state);
            }
            this.emit(event, state);
            return state;
        } catch (error) {
            if (error.state) await this.applyState(error.state);
            throw error;
        } finally {
            this.busy = false;
            this.emit("busy", false);
        }
    }
    newGame(config = {}) {
        return this.perform(() => this.api.newGame({ ...config, ...this.context() }), { reset: true });
    }
    refresh() { return this.perform(() => this.api.getState()); }
    importGame(file) {
        return this.perform(() => this.api.importGame(file, this.context()), { reset: true });
    }
    getLegalMoves(square) {
        if (this.state?.gameOver || this.state?.winner) return Promise.resolve([]);
        return this.api.getLegalMoves(square);
    }
    move(move) {
        if (this.state?.gameOver || this.state?.winner) return Promise.resolve();
        return this.perform(() => this.api.makeMove(move, this.context()), { animate: true, event: "move" });
    }
    resign() { return this.perform(() => this.api.resign(this.context())); }
    offerDraw() { return this.perform(() => this.api.offerDraw(this.context())); }
    acceptDraw(color) { return this.perform(() => this.api.acceptDraw(color, this.context())); }
    declineDraw(color) { return this.perform(() => this.api.declineDraw(color, this.context())); }
    claimFiftyMoveDraw() { return this.perform(() => this.api.claimFiftyMoveDraw(this.context())); }
    undo() { return this.perform(() => this.api.undo(), { event: "undo" }); }
    redo() { return this.perform(() => this.api.redo(), { event: "redo" }); }
    aiMove(level = 1) {
        return this.perform(() => this.api.aiMove(level), { animate: true, event: "ai" });
    }
    replay(step) { return this.perform(() => this.api.replay(step)); }

    async applyState(state) {
        if (!state) return;
        const previousWinner = this.state?.winner;
        this.state = state;
        this.board.inputManager.clearSelection();
        this.board.updateBoard(state);
        this.emit("state", state);
        if (state.winner && state.winner !== previousWinner) {
            await this.board.effectLayer.playVictory();
        }
    }
    async animateTransition(oldState, newState) {
        if (oldState && newState.lastMove) await this.board.pieceLayer.animateMove(newState.lastMove);
    }
    exportState() { return this.state; }
    currentTurn() { return this.state?.turn; }
    winner() { return this.state?.winner; }
    isBusy() { return this.busy; }
}

