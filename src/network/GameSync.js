export default class GameSync {
    constructor(board, api) {
        this.board = board;
        this.api = api;
        this.state = null;
        this.busy = false;
        this.generation = 0;
        this.operation = null;
        this.botRequest = null;
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
    invalidate() {
        this.generation++;
        this.operation = null;
        this.busy = false;
    }
    async perform(request, { animate = false, reset = false, event = "change", replace = false, bot = false } = {}) {
        if (this.busy && !replace) return;
        if (replace) this.generation++;
        const operation = { generation: this.generation, base: this.state, reset, bot };
        this.operation = operation;
        const current = () => this.operation === operation && this.generation === operation.generation;
        const canApply = () => current() && this.state === operation.base;
        let applied = false;
        this.busy = true;
        this.emit("busy", true);
        try {
            const response = await request();
            if (!canApply()) return;
            const state = response.state ?? response;
            if (bot && (state.gameId !== operation.base?.gameId || state.revision <= operation.base?.revision)) return;
            if (reset) this.board.resetBoard();
            try {
                if (animate) await this.animateTransition(operation.base, state);
            } finally {
                // The server's committed state must survive rendering failures.
                if (canApply()) {
                    applied = true;
                    await this.applyState(state, { operation });
                }
            }
            if (!current()) return;
            this.emit(event, state);
            return state;
        } catch (error) {
            if (!current() || (!applied && !canApply())) return;
            if (error.state) await this.applyState(error.state, { operation });
            if (!current()) return;
            throw error;
        } finally {
            if (this.operation === operation) {
                this.operation = null;
                this.busy = false;
                this.emit("busy", false);
            }
        }
    }
    newGame(config = {}) {
        return this.replaceGame(context => this.api.newGame({ ...config, ...context }));
    }
    refresh() { return this.perform(() => this.api.getState()); }
    importGame(file) {
        return this.replaceGame(context => this.api.importGame(file, context));
    }
    replaceGame(request) {
        const pending = this.busy || this.isBotBusy();
        return this.perform(async () => {
            // The Worker may have committed a bot move before its reply reaches this tab.
            const latest = pending ? await this.api.getState() : this.state;
            return request({ gameId: latest?.gameId, revision: latest?.revision });
        }, { reset: true, replace: true });
    }
    getLegalMoves(square) {
        if (this.state?.gameOver || this.state?.winner) return Promise.resolve([]);
        return this.api.getLegalMoves(square);
    }
    move(move) {
        if (this.state?.gameOver || this.state?.winner) return Promise.resolve();
        return this.perform(() => this.api.makeMove(move, this.context()), { animate: true, event: "move" });
    }
    resign() {
        const pending = this.isBotBusy();
        const gameId = this.state?.gameId;
        return this.perform(async () => {
            const latest = pending ? await this.api.getState() : this.state;
            if (latest?.gameId !== gameId) throw Object.assign(new Error("Game changed"), { code: "stale_state", status: 409, state: latest });
            return this.api.resign({ gameId: latest?.gameId, revision: latest?.revision });
        }, { replace: pending });
    }
    offerDraw() { return this.perform(() => this.api.offerDraw(this.context())); }
    acceptDraw(color) { return this.perform(() => this.api.acceptDraw(color, this.context())); }
    declineDraw(color) { return this.perform(() => this.api.declineDraw(color, this.context())); }
    claimFiftyMoveDraw() { return this.perform(() => this.api.claimFiftyMoveDraw(this.context())); }
    undo() { return this.perform(() => this.api.undo(), { event: "undo" }); }
    redo() { return this.perform(() => this.api.redo(), { event: "redo" }); }
    aiMove(level = 1) {
        if (this.busy || this.botRequest || this.state?.gameOver || this.state?.winner) return Promise.resolve();
        const flight = {};
        this.botRequest = flight;
        return this.perform(() => this.api.aiMove(level, this.context()), { animate: true, event: "ai", bot: true })
            .finally(() => {
                if (this.botRequest === flight) this.botRequest = null;
                this.emit("busy", this.busy);
            });
    }
    replay(step) { return this.perform(() => this.api.replay(step)); }

    async applyState(state, { operation = null } = {}) {
        if (!state) return;
        if (operation && this.operation !== operation) return;
        const differentGame = this.state?.gameId && state.gameId && this.state.gameId !== state.gameId;
        const invalidate = !operation || (differentGame && !operation.reset);
        if (invalidate) {
            if (this.busy || differentGame) this.board.resetBoard?.();
            this.invalidate();
        }
        const previousWinner = this.state?.winner;
        this.state = state;
        this.board.inputManager.clearSelection();
        this.board.updateBoard(state);
        this.emit("state", state);
        if (state.winner && state.winner !== previousWinner) {
            await this.board.effectLayer.playVictory();
        }
        if (invalidate) this.emit("busy", this.busy);
    }
    async animateTransition(oldState, newState) {
        if (oldState && newState.lastMove) await this.board.pieceLayer.animateMove(newState.lastMove);
    }
    exportState() { return this.state; }
    currentTurn() { return this.state?.turn; }
    winner() { return this.state?.winner; }
    isBusy() { return this.busy; }
    isBotBusy() { return Boolean(this.botRequest); }
    isBotOperation() { return Boolean(this.operation?.bot); }
}

