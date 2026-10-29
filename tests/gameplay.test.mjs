import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";

// Load the browser's dependency-free modules without changing the app's package type.
async function moduleAt(path) {
    const source = await readFile(new URL("../src/" + path, import.meta.url), "utf8");
    return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}
const { default: InputManager } = await moduleAt("board/InputManager.js");
const { default: GameSync } = await moduleAt("network/GameSync.js");
const { default: ApiClient } = await moduleAt("network/ApiClient.js");
const { animate, cancelAnimations } = await moduleAt("effects/Animation.js");

class Ticker {
    callbacks = new Set();
    add(callback) { this.callbacks.add(callback); }
    remove(callback) { this.callbacks.delete(callback); }
    tick(ms = 16.67) { for (const cb of [...this.callbacks]) cb({ deltaMS: ms }); }
}
class Board extends EventEmitter {
    // Match Pixi's listener context behavior.
    on(event, callback, context) {
        this.bindings ??= new Map();
        const bound = callback.bind(context);
        this.bindings.set(callback, bound);
        return super.on(event, bound);
    }
    off(event, callback) {
        return super.off(event, this.bindings?.get(callback) ?? callback);
    }
    cancelPromotionDialog() {}
    clearSelection() { this.selected = null; }
    clearLegalMoves() { this.moves = []; }
    selectSquare(square) { this.selected = square; }
    showLegalMoves(moves) { this.moves = moves; }
}
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

test("Pixi v8 ticker completes many animations and releases callbacks", async () => {
    const ticker = new Ticker();
    for (let i = 0; i < 100; i++) {
        const owner = {};
        let progress;
        const done = animate(owner, ticker, 200, t => { progress = t; });
        for (let frame = 0; frame < 20; frame++) ticker.tick();
        assert.equal(await done, true);
        assert.equal(progress, 1);
        assert.equal(ticker.callbacks.size, 0);
        assert.equal(owner._animations.size, 0);
    }
});

test("reset cancels animations and settles pending promises", async () => {
    const ticker = new Ticker(), owner = {};
    const done = animate(owner, ticker, 500, () => {});
    ticker.tick();
    cancelAnimations(owner);
    assert.equal(await done, false);
    assert.equal(ticker.callbacks.size, 0);
});

test("drawing errors reject and remove ticker callbacks", async () => {
    const ticker = new Ticker();
    const done = animate({}, ticker, 50, () => { throw Error("render failed"); });
    ticker.tick();
    await assert.rejects(done, /render failed/);
    assert.equal(ticker.callbacks.size, 0);
});

test("100 enable/rematch cycles keep a single listener and a single move per click", async () => {
    const board = new Board(), input = new InputManager(board);
    let calls = 0;
    input.setLegalMoveProvider(async from => [{ from, to: "a3" }]);
    input.setMoveProvider(async () => { calls++; });
    for (let game = 0; game < 100; game++) {
        input.enable();
        input.enable();
        assert.equal(board.listenerCount("cell-click"), 1);
        assert.equal(board.listenerCount("cell-hover"), 1);
        await input.handleClick("a2");
        await input.handleClick("a3");
        input.disable();
        assert.equal(board.listenerCount("cell-click"), 0);
    }
    assert.equal(calls, 100);
});

test("rapid clicks cannot submit duplicate moves", async () => {
    const board = new Board(), input = new InputManager(board), pending = deferred();
    let calls = 0;
    input.enable();
    input.selectedSquare = "a2";
    input.legalMoves = [{ from: "a2", to: "a3" }];
    input.setMoveProvider(async () => { calls++; await pending.promise; });
    const first = input.handleClick("a3");
    await input.handleClick("a3");
    assert.equal(calls, 1);
    pending.resolve();
    await first;
    assert.equal(input.busy, false);
});

test("late legal-move replies after disable/restart cannot select old pieces", async () => {
    const board = new Board(), input = new InputManager(board), pending = deferred();
    input.enable();
    input.setLegalMoveProvider(() => pending.promise);
    const click = input.handleClick("a2");
    input.disable();
    input.enable();
    pending.resolve([{ from: "a2", to: "a3" }]);
    await click;
    assert.equal(input.selectedSquare, null);
    assert.equal(board.selected, null);
});

test("all promotion choices and cancellation are honored", async () => {
    for (const choice of ["Ngua", "Voi", "Ga", null]) {
        const board = new Board(), input = new InputManager(board);
        const sent = [];
        board.showPromotionDialog = async () => choice;
        input.enable();
        input.selectedSquare = "a8";
        input.legalMoves = ["Ngua", "Voi", "Ga"].map(promotion => ({
            from: "a8", to: "a9", promotion
        }));
        input.setMoveProvider(async move => { sent.push(move); });
        await input.handleClick("a9");
        assert.equal(sent.length, choice ? 1 : 0);
        if (choice) assert.equal(sent[0].promotion, choice);
        assert.equal(input.busy, false);
    }
});

test("API maps promotion names to server codes without mutating legal moves", async () => {
    const api = new ApiClient();
    api.request = async (path, method, body) => body;
    for (const [promotion, code] of [["Ngua", "n"], ["Voi", "v"], ["Ga", "g"]]) {
        const original = { from: "a8", to: "a9", promotion };
        assert.equal((await api.makeMove(original)).promotion, code);
        assert.equal(original.promotion, promotion);
    }
});

test("request failures release input so the next action can run", async () => {
    const board = new Board(), input = new InputManager(board);
    const errors = [];
    board.on("input-error", error => errors.push(error));
    input.enable();
    input.setLegalMoveProvider(async () => { throw Error("offline"); });
    await input.handleClick("a2");
    assert.equal(input.busy, false);
    assert.equal(errors.length, 1);
    input.setLegalMoveProvider(async from => [{ from, to: "a3" }]);
    await input.handleClick("a2");
    assert.equal(input.selectedSquare, "a2");
});

test("sync applies server state after animation failure and releases its lock", async () => {
    const state = { pieces: [], lastMove: { from: "a2", to: "a3" } };
    const board = {
        inputManager: { clearSelection() {} },
        updateBoard(value) { this.state = value; },
        pieceLayer: { async animateMove() { throw Error("animation"); } },
        effectLayer: { async playVictory() {} }
    };
    const sync = new GameSync(board, { async makeMove() { return state; } });
    sync.state = { pieces: [] };
    await assert.rejects(sync.move({}), /animation/);
    assert.equal(sync.busy, false);
    assert.equal(board.state, state);
});

test("new games reset the board and repeated winner states do not replay effects", async () => {
    let resets = 0, victories = 0;
    const board = {
        inputManager: { clearSelection() {} },
        resetBoard() { resets++; },
        updateBoard(value) { this.state = value; },
        effectLayer: { async playVictory() { victories++; } }
    };
    const state = { pieces: [], lastMove: null };
    const sync = new GameSync(board, { async newGame() { return state; } });
    for (let i = 0; i < 20; i++) await sync.newGame();
    assert.equal(resets, 20);
    await sync.applyState({ ...state, winner: "son" });
    await sync.applyState({ ...state, winner: "son" });
    assert.equal(victories, 1);
    assert.equal(sync.busy, false);
});

test("draw actions apply authoritative state and carry the version of the current game", async () => {
    const calls = [];
    const initial = { gameId: "one", revision: 2, turn: "thuy", pieces: [] };
    const offered = { ...initial, revision: 3, drawOfferPending: "thuy" };
    const declined = { ...initial, revision: 4, drawOfferPending: null };
    const terminal = { ...initial, revision: 5, winner: "draw", gameOver: true, result: "draw_by_agreement" };
    const board = {
        inputManager: { clearSelection() {} },
        updateBoard(state) { this.state = state; },
        effectLayer: { async playVictory() {} },
    };
    const api = {
        async offerDraw(context) { calls.push(["offer", context]); return { state: offered }; },
        async declineDraw(color, context) { calls.push(["decline", color, context]); return { state: declined }; },
        async acceptDraw(color, context) { calls.push(["accept", color, context]); return { state: terminal }; },
    };
    const sync = new GameSync(board, api);
    sync.state = initial;
    await sync.offerDraw();
    assert.equal(sync.exportState(), offered);
    await sync.declineDraw("son");
    await sync.acceptDraw("son");
    assert.deepEqual(calls, [
        ["offer", { gameId: "one", revision: 2 }],
        ["decline", "son", { gameId: "one", revision: 3 }],
        ["accept", "son", { gameId: "one", revision: 4 }],
    ]);
    assert.equal(board.state, terminal);
    assert.equal(sync.isBusy(), false);
});

test("duplicate requests share one busy lock and terminal conflict updates the displayed state", async () => {
    const pending = deferred();
    let submitted = 0;
    const terminal = { gameOver: true, winner: "son", pieces: [], result: "resignation" };
    const board = {
        inputManager: { clearSelection() {} },
        updateBoard(state) { this.state = state; },
        effectLayer: { async playVictory() {} },
    };
    const api = { async resign() { submitted++; return pending.promise; } };
    const sync = new GameSync(board, api);
    const first = sync.resign();
    await sync.resign();
    assert.equal(submitted, 1);
    const conflict = Object.assign(new Error("over"), { status: 409, state: terminal });
    pending.reject(conflict);
    await assert.rejects(first, /over/);
    assert.equal(sync.exportState(), terminal);
    assert.equal(board.state, terminal);
    assert.equal(sync.busy, false);
    assert.deepEqual(await sync.getLegalMoves("a1"), []);
});

test("API draw methods send distinct offer, response and claim actions", async () => {
    const api = new ApiClient();
    api.request = async (path, method, body) => ({ path, method, body });
    const context = { gameId: "one", revision: 4 };
    assert.equal((await api.offerDraw(context)).body.action, "offer");
    assert.deepEqual((await api.acceptDraw("son", context)).body, { ...context, action: "accept", color: "son" });
    assert.deepEqual((await api.declineDraw("thuy", context)).body, { ...context, action: "decline", color: "thuy" });
    assert.equal((await api.claimFiftyMoveDraw(context)).body.action, "claim_fifty");
    assert.deepEqual((await api.resign(context)).body, context);
});

test("bot RPC carries game version through GameSync and ApiClient, deduplicates and stops at game over", async () => {
    const pending = deferred(), calls = [], animations = [];
    const before = { gameId: "bot-game", revision: 7, turn: "son", pieces: [] };
    const after = { ...before, revision: 8, turn: "thuy", lastMove: { from: "a8", to: "a7" } };
    const api = new ApiClient();
    api.request = async (path, method, body) => {
        calls.push({ path, method, body });
        return pending.promise;
    };
    const board = {
        inputManager: { clearSelection() {} },
        updateBoard(state) { this.state = state; },
        pieceLayer: { async animateMove(move) { animations.push(move); } },
        effectLayer: { async playVictory() {} },
    };
    const sync = new GameSync(board, api);
    sync.state = before;
    const first = sync.aiMove(1);
    await sync.aiMove(1);
    assert.equal(sync.isBusy(), true);
    assert.deepEqual(calls, [{ path: "/ai_move", method: "POST",
        body: { level: 1, gameId: "bot-game", revision: 7 } }]);
    pending.resolve(after);
    assert.equal(await first, after);
    assert.deepEqual(animations, [after.lastMove]);
    assert.equal(board.state, after);
    assert.equal(sync.isBusy(), false);
    for (const terminal of [{ gameOver: true }, { winner: "son" }, { winner: "draw" }]) {
        sync.state = { ...after, ...terminal };
        await sync.aiMove();
    }
    assert.equal(calls.length, 1);
});

for (const fail of [false, true]) test(`loading another game ignores a late bot ${fail ? "error" : "reply"} and retains one bot request`, async () => {
    const old = deferred(), calls = [];
    const original = { gameId: "old", revision: 0, turn: "thuy", pieces: [] };
    const committed = { ...original, revision: 1, turn: "son", lastMove: { from: "a2", to: "a3" } };
    const loaded = { gameId: "loaded", revision: 0, turn: "thuy", pieces: [] };
    const board = { inputManager: { clearSelection() {} }, resetBoard() {},
        updateBoard(state) { this.state = state; },
        pieceLayer: { async animateMove() { assert.fail("Old move must not animate"); } },
        effectLayer: { async playVictory() {} } };
    const api = { aiMove(level, context) { calls.push(context); return old.promise; },
        async getState() { return committed; },
        async importGame(file, context) { assert.deepEqual(context, { gameId: "old", revision: 1 }); return loaded; } };
    const sync = new GameSync(board, api); sync.state = original;
    const pending = sync.aiMove();
    await sync.importGame("file");
    assert.equal(sync.exportState(), loaded);
    assert.equal(sync.isBusy(), false);
    assert.equal(sync.isBotBusy(), true);
    await sync.aiMove();
    assert.equal(calls.length, 1);
    if (fail) old.reject(Object.assign(new Error("old error"), { state: committed }));
    else old.resolve(committed);
    await pending;
    assert.equal(sync.exportState(), loaded);
    assert.equal(board.state, loaded);
    assert.equal(sync.isBotBusy(), false);
});

test("an old bot completion cannot unlock a pending import", async () => {
    const bot = deferred(), imported = deferred();
    const before = { gameId: "old", revision: 0, pieces: [] };
    const board = { inputManager: { clearSelection() {} }, resetBoard() {}, updateBoard() {} };
    const sync = new GameSync(board, { aiMove: () => bot.promise, getState: async () => before, importGame: () => imported.promise });
    sync.state = before;
    const old = sync.aiMove(); const replacement = sync.importGame("file");
    bot.resolve({ ...before, revision: 1 }); await old;
    assert.equal(sync.isBusy(), true);
    const loaded = { gameId: "new", revision: 0, pieces: [] };
    imported.resolve(loaded); await replacement;
    assert.equal(sync.exportState(), loaded); assert.equal(sync.isBusy(), false);
});

test("a bot animation completing after replacement cannot restore the old board", async () => {
    const animation = deferred(), started = deferred();
    const before = { gameId: "old", revision: 0, pieces: [] };
    const loaded = { gameId: "new", revision: 0, pieces: [] };
    const board = { inputManager: { clearSelection() {} }, resetBoard() {}, updateBoard(state) { this.state = state; },
        pieceLayer: { animateMove() { started.resolve(); return animation.promise; } } };
    const sync = new GameSync(board, { aiMove: async () => ({ ...before, revision: 1, lastMove: {} }),
        getState: async () => ({ ...before, revision: 1 }), importGame: async () => loaded });
    sync.state = before;
    const old = sync.aiMove(); await started.promise;
    await sync.importGame("file");
    animation.resolve(); await old;
    assert.equal(sync.exportState(), loaded); assert.equal(board.state, loaded);
});
