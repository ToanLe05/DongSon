import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { Texture, Container } from "pixi.js";

// Exercise real Pixi containers, sprites and graphics with a deterministic ticker.
// Only Vite's image loader is replaced; asset URL packaging is checked by the build.
const assetsURL = new URL("../src/assets.js", import.meta.url).href;
globalThis.__testTexture = Texture.WHITE;
const hooks = registerHooks({
    load(url, context, nextLoad) {
        if (url === assetsURL) return {
            format: "module", shortCircuit: true,
            source: "export const preloadAssets = async () => {}; export const getAssetTexture = path => path.includes('missing') ? null : globalThis.__testTexture;"
        };
        if (url.startsWith(new URL("../src/", import.meta.url).href) && url.endsWith(".js")) {
            return { format: "module", shortCircuit: true, source: readFileSync(new URL(url), "utf8") };
        }
        return nextLoad(url, context);
    }
});
const { default: PieceLayer } = await import("../src/board/PieceLayer.js");
const { default: EffectLayer } = await import("../src/board/EffectLayer.js");
const { default: PieceFactory } = await import("../src/pieces/PieceFactory.js");
const { default: MoveAnimation } = await import("../src/effects/MoveAnimation.js");
const { default: PingEffect } = await import("../src/effects/PingEffect.js");
const { default: GlowEffect } = await import("../src/effects/GlowEffect.js");
const { default: GridRenderer } = await import("../src/board/GridRenderer.js");
hooks.deregister();

test("redrawing the grid preserves other layers and releases replaced graphics", () => {
    const gridLayer = new Container();
    const coordinates = new Container();
    gridLayer.addChild(coordinates);
    const b = { gridLayer, cellSize: 60, widthPx: 540, heightPx: 540 };
    const grid = new GridRenderer(b);
    grid.draw();
    for (let i = 0; i < 100; i++) {
        const previous = [...grid.container.children];
        grid.draw();
        assert.equal(coordinates.parent, gridLayer, "Redrawing must not detach coordinate labels");
        assert(previous.every(graphic => graphic.destroyed), "Replaced graphics must release their resources");
    }
    gridLayer.destroy({ children: true });
});

class Ticker {
    callbacks = new Set();
    add(fn, context) {
        if (context) {
            this.bindings ??= new Map();
            const bound = fn.bind(context);
            this.bindings.set(fn, bound);
            this.callbacks.add(bound);
        } else this.callbacks.add(fn);
    }
    remove(fn) { this.callbacks.delete(this.bindings?.get(fn) ?? fn); }
    tick() { for (const fn of [...this.callbacks]) fn({ deltaMS: 1000 / 60 }); }
}
function board() {
    return {
        cellSize: 60,
        app: { ticker: new Ticker() },
        squareToCoord(square) { return { row: +square.slice(1) - 1, col: "abcdefghk".indexOf(square[0]) }; },
        boardToScreen(row, col) { return { x: col * this.cellSize, y: (8 - row) * this.cellSize }; }
    };
}
const piece = (id, square, type = "Bo", color = "thuy") => ({
    id, square, type, color, promoted: false, frozen: false, enteredPalace: false
});
async function finish(promise, ticker) {
    for (let i = 0; i < 150; i++) { ticker.tick(); await Promise.resolve(); }
    await promise;
}

test("real Pixi sprites complete repeated moves, capture and promotion without leaking callbacks", async () => {
    const b = board(), layer = new PieceLayer(b);
    layer.updatePieces([piece(1, "a2"), piece(2, "a4", "Bo", "son")]);
    await finish(layer.animateMove({ id: 1, from: "a2", to: "a3" }), b.app.ticker);
    await finish(layer.animateMove({ id: 1, from: "a3", to: "a4", capture: true }), b.app.ticker);
    assert.equal(layer.pieces.size, 1);
    assert.equal(layer.getPieceAt("a4").id, 1);
    const sprite = layer.getPiece(1);
    for (const promotion of ["Ngua", "Voi", "Ga"]) {
        sprite.setBoardPosition("a8");
        await finish(layer.animateMove({ id: 1, from: "a8", to: "a9", promotion }), b.app.ticker);
        assert.equal(sprite.type, promotion);
        assert.equal(sprite.promoted, true);
        assert.equal(sprite.rotation, 0);
        assert.equal(sprite.pieceLabel.visible, false);
        assert.equal(sprite.textureSprite.visible, true);
    }
    for (let i = 0; i < 50; i++) {
        await finish(layer.animateMove({ id: 1, from: sprite.square, to: i % 2 ? "a8" : "a9" }), b.app.ticker);
    }
    assert.equal(b.app.ticker.callbacks.size, 0);
    layer.destroy({ children: true });
});

test("Hoan Quan animates both pieces and preserves their identities", async () => {
    const b = board(), layer = new PieceLayer(b);
    layer.updatePieces([piece(1, "e1", "Than"), piece(2, "c1", "Voi")]);
    await finish(layer.animateMove({ from: "e1", to: "c1", isHoanQuan: true }), b.app.ticker);
    assert.equal(layer.getPiece(1).square, "c1");
    assert.equal(layer.getPiece(2).square, "e1");
    assert.equal(b.app.ticker.callbacks.size, 0);
    layer.destroy({ children: true });
});

test("destroy during capture or movement settles animations safely", async () => {
    for (const capture of [false, true]) {
        const b = board(), layer = new PieceLayer(b);
        layer.updatePieces([piece(1, "a2"), piece(2, "a3", "Bo", "son")]);
        const moving = layer.animateMove({ id: 1, from: "a2", to: "a3", capture });
        b.app.ticker.tick();
        layer.clear();
        await moving;
        assert.equal(b.app.ticker.callbacks.size, 0);
        assert.equal(layer.pieces.size, 0);
    }
});

test("texture fallback and resize update visibility, size and board position", () => {
    const b = board(), sprite = PieceFactory.create(piece(1, "a2"), b);
    b.cellSize = 90;
    PieceFactory.update(sprite, piece(1, "a3"));
    assert.equal(sprite.textureSprite.width, 90 * 0.82);
    assert.equal(sprite.x, 45);
    assert.equal(sprite.y, 585);
    PieceFactory.update(sprite, piece(1, "a3", "missing"));
    assert.equal(sprite.body.visible, true);
    assert.equal(sprite.pieceLabel.visible, true);
    assert.equal(sprite.textureSprite.visible, false);
    sprite.destroy();
});

test("reset clears check and finite effects, settles victory and restores alpha", async () => {
    const b = board(), layer = new EffectLayer(b);
    layer.showCheck("e1");
    layer.showCheck("e1");
    assert.equal(b.app.ticker.callbacks.size, 1);
    const ring = layer.playCapture("a3");
    const victory = layer.playVictory();
    b.app.ticker.tick();
    layer.clear();
    await Promise.all([ring, victory]);
    assert.equal(b.app.ticker.callbacks.size, 0);
    assert.equal(layer.effectContainer.children.length, 0);
    assert.equal(layer.alpha, 1);
    layer.destroy();
});

test("shared move helper and auxiliary effects finish or cancel with Pixi v8 ticks", async () => {
    const b = board(), sprite = PieceFactory.create(piece(1, "a2"), b);
    await finish(MoveAnimation.jump(sprite, b, "a3"), b.app.ticker);
    await finish(MoveAnimation.promotion(sprite, b), b.app.ticker);
    assert.equal(sprite.square, "a3");
    const ping = new PingEffect(b.app);
    const pinging = ping.play(10, 10);
    b.app.ticker.tick();
    ping.stop();
    await pinging;
    const glow = new GlowEffect(b.app);
    glow.start();
    const pulsing = glow.pulse();
    b.app.ticker.tick();
    glow.destroy();
    await pulsing;
    assert.equal(b.app.ticker.callbacks.size, 0);
    sprite.destroy();
    ping.destroy();
});
