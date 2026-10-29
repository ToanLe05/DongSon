import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";

async function moduleURL(path) {
    let source = await readFile(path, "utf8");
    for (const match of [...source.matchAll(/from "(\.[^"]+)"/g)]) {
        source = source.replace(match[0], `from "${await moduleURL(new URL(match[1], path))}"`);
    }
    return "data:text/javascript;base64," + Buffer.from(source).toString("base64");
}
const { default: MatchController } = await import(await moduleURL(new URL("../src/ui/MatchController.js", import.meta.url)));
const { default: GameSync } = await import(await moduleURL(new URL("../src/network/GameSync.js", import.meta.url)));
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const botConfig = { mode: "human_vs_bot", humanColor: "son", botId: "random" };
const humanConfig = { mode: "human_vs_human", humanColor: null, botId: null };
function state(extra = {}) { return { gameId: "game", revision: 0, started: true, movesPlayed: 0, turn: "thuy",
    pieces: [{ square: "a2", color: "thuy" }, { square: "a8", color: "son" }], matchConfig: botConfig, ...extra }; }
function setup(api) {
    const nodes = new Map();
    const modes = ["human_vs_human", "human_vs_bot"].map((value, i) => ({ value, checked: i === 0 }));
    const sides = ["thuy", "son"].map((value, i) => ({ value, checked: i === 0 }));
    const document = {
        getElementById(id) {
            if (!nodes.has(id)) nodes.set(id, { textContent: "", attributes: {}, handlers: {},
                setAttribute(key, value) { this.attributes[key] = value; },
                addEventListener(key, fn) { this.handlers[key] = fn; }, removeEventListener(key) { delete this.handlers[key]; } });
            return nodes.get(id);
        },
        querySelectorAll(selector) { return selector.includes("play-mode") ? modes : sides; },
        querySelector(selector) { return this.querySelectorAll(selector).find(input => input.checked); },
    };
    const board = new EventEmitter();
    board.inputManager = { busy: false, enabled: false, clearSelection() {},
        enable() { this.enabled = true; }, disable() { this.enabled = false; },
        setLegalMoveProvider(fn) { this.legal = fn; }, setMoveProvider(fn) { this.move = fn; } };
    board.resetBoard = () => {};
    board.updateBoard = value => { board.state = value; };
    board.pieceLayer = { async animateMove() {} }; board.effectLayer = { async playVictory() {} };
    const sync = new GameSync(board, api), match = new MatchController(board, sync, document);
    return { board, sync, match, nodes, modes, sides };
}

test("restoring a bot turn locks input, thinks once across repeated renders, then enables the human", async () => {
    const bot = deferred(); let calls = 0;
    const t = setup({ getState: async () => state(), aiMove() { calls++; return bot.promise; } });
    await t.match.restore(); await flush();
    for (let i = 0; i < 100; i++) t.match.render();
    assert.equal(calls, 1); assert.equal(t.board.inputManager.enabled, false);
    assert.equal(t.nodes.get("status-line").textContent, "Bot đang nghĩ…");
    assert.equal(t.nodes.get("btn-import-game").disabled, false);
    bot.resolve(state({ turn: "son", revision: 1, movesPlayed: 1 })); await flush();
    assert.equal(t.board.inputManager.enabled, true); assert.equal(t.sync.isBotBusy(), false);
    t.match.destroy();
});

test("start honors the chosen side and triggers the opening bot exactly once", async () => {
    const bot = deferred(); let calls = 0;
    const t = setup({ getState: async () => state({ started: false, matchConfig: humanConfig }),
        newGame: async config => { assert.equal(config.humanColor, "son"); return state({ gameId: "new" }); },
        aiMove() { calls++; return bot.promise; } });
    t.modes.forEach(input => { input.checked = input.value === "human_vs_bot"; });
    t.sides.forEach(input => { input.checked = input.value === "son"; });
    await t.match.start(); await flush();
    assert.equal(calls, 1);
    bot.resolve(state({ gameId: "new", turn: "son", revision: 1 })); await flush(); t.match.destroy();
});

test("a human move schedules one bot response and a terminal state schedules none", async () => {
    const bot = deferred(); let calls = 0;
    const config = { ...botConfig, humanColor: "thuy" };
    const t = setup({ getState: async () => state({ matchConfig: config }),
        makeMove: async () => state({ turn: "son", revision: 1, matchConfig: config }),
        aiMove() { calls++; return bot.promise; } });
    await t.match.restore(); await flush(); assert.equal(calls, 0);
    await t.board.inputManager.move({ from: "a2", to: "a3" }); await flush(); assert.equal(calls, 1);
    bot.resolve(state({ revision: 2, matchConfig: config, turn: "thuy", winner: "thuy", gameOver: true })); await flush();
    for (let i = 0; i < 20; i++) t.match.render();
    assert.equal(calls, 1); assert.equal(t.board.inputManager.enabled, false); t.match.destroy();
});

for (const fail of [false, true]) test(`loading during bot thinking preserves the new game after an old ${fail ? "error" : "reply"}`, async () => {
    const bot = deferred(); let reads = 0;
    const loaded = state({ gameId: "loaded", matchConfig: humanConfig });
    const t = setup({ getState: async () => { reads++; return state({ revision: reads > 1 ? 1 : 0 }); },
        aiMove: () => bot.promise, readSavedGame: async () => ({ file: "file" }),
        inspectGame: async () => loaded, importGame: async () => loaded });
    t.match.dialog.open = async () => "load";
    await t.match.restore(); await flush();
    await t.match.load();
    assert.equal(t.sync.exportState(), loaded); assert.equal(t.board.inputManager.enabled, true);
    const message = t.nodes.get("action-message").textContent;
    if (fail) bot.reject(Object.assign(new Error("old failure"), { state: state({ revision: 1 }) }));
    else bot.resolve(state({ turn: "son", revision: 1 }));
    await flush();
    assert.equal(t.sync.exportState(), loaded); assert.equal(t.board.state, loaded);
    assert.equal(t.nodes.get("action-message").textContent, message); assert.equal(reads, 2);
    t.match.destroy();
});

test("current bot failure offers a retry without an automatic request loop", async () => {
    const retry = deferred(); let calls = 0;
    const t = setup({ getState: async () => state(), aiMove() {
        calls++; return calls === 1 ? Promise.reject(Object.assign(new Error("Bot gặp lỗi khi chọn nước."), { code: "bot_error" })) : retry.promise;
    } });
    await t.match.restore(); await flush();
    for (let i = 0; i < 50; i++) t.match.render();
    assert.equal(calls, 1); assert.equal(t.nodes.get("btn-retry-bot").hidden, false);
    assert.equal(t.nodes.get("action-message").textContent, "Bot gặp lỗi khi chọn nước.");
    t.nodes.get("btn-retry-bot").handlers.click(); await flush(); assert.equal(calls, 2);
    retry.resolve(state({ turn: "son", revision: 1 })); await flush();
    assert.equal(t.board.inputManager.enabled, true); t.match.destroy();
});

test("human ownership blocks opponent selection and move requests", async () => {
    let queries = 0, moves = 0;
    const t = setup({ getState: async () => state({ turn: "son" }),
        getLegalMoves: async () => { queries++; return []; }, makeMove: async () => { moves++; return state({ turn: "son" }); } });
    await t.match.restore();
    await t.board.inputManager.legal("a2"); await t.board.inputManager.move({ from: "a2", to: "a3" });
    assert.equal(queries, 0); assert.equal(moves, 0);
    await t.board.inputManager.legal("a8"); assert.equal(queries, 1);
    t.match.destroy();
});

test("resigning during bot thinking names the human and ignores the late bot reply", async () => {
    const bot = deferred(); let request, prompt;
    const terminal = state({ revision: 1, gameOver: true, winner: "thuy", result: "resignation" });
    const t = setup({ getState: async () => state(), aiMove: () => bot.promise,
        resign: async context => { request = context; return terminal; } });
    t.match.dialog.open = async choice => { prompt = choice; return "resign"; };
    await t.match.restore(); await flush();
    assert.equal(t.nodes.get("btn-end").disabled, false);
    await t.match.resign();
    assert.equal(prompt.title, "Sơn Tinh xác nhận đầu hàng?");
    assert.deepEqual(request, { gameId: "game", revision: 0 });
    assert.equal(t.sync.exportState(), terminal);
    assert.equal(t.match.readConfig().humanColor, "son");
    assert.equal(t.match.readConfig().mode, "human_vs_bot");
    bot.resolve(state({ turn: "son", revision: 1 })); await flush();
    assert.equal(t.sync.exportState(), terminal); assert.equal(t.nodes.get("btn-rematch").hidden, false);
    t.match.destroy();
});

test("replacing a game before the queued bot starts sends only the new game's request", async () => {
    const bot = deferred(), contexts = [];
    const t = setup({ aiMove(level, context) { contexts.push(context); return bot.promise; } });
    const first = t.sync.applyState(state());
    const second = t.sync.applyState(state({ gameId: "newer" }));
    await Promise.all([first, second]); await flush();
    assert.deepEqual(contexts, [{ gameId: "newer", revision: 0 }]);
    bot.resolve(state({ gameId: "newer", turn: "son", revision: 1 })); await flush(); t.match.destroy();
});
