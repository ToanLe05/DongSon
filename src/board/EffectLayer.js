import * as PIXI from "pixi.js";
import { animate, cancelAnimations, deltaMS } from "../effects/Animation.js";

export default class EffectLayer extends PIXI.Container {
    constructor(board) {
        super();
        this.board = board;
        this.checkGraphics = new PIXI.Graphics();
        this.effectContainer = new PIXI.Container();
        this.addChild(this.checkGraphics, this.effectContainer);
        this.checkTicker = null;
    }
    squareCenter(square) {
        const { row, col } = this.board.squareToCoord(square);
        const p = this.board.boardToScreen(row, col);
        return { x: p.x + this.board.cellSize / 2, y: p.y + this.board.cellSize / 2 };
    }
    showCheck(square) {
        this.clearCheck();
        if (!square) return;
        let time = 0;
        this.checkTicker = tick => {
            time += deltaMS(tick) / 1000;
            const center = this.squareCenter(square);
            this.checkGraphics.clear().circle(center.x, center.y,
                this.board.cellSize * 0.42 + Math.sin(time * 4) * 5)
                .stroke({ width: 4, color: 0xff0000, alpha: 0.85 });
        };
        this.board.app.ticker.add(this.checkTicker);
    }
    clearCheck() {
        if (this.checkTicker) this.board.app.ticker.remove(this.checkTicker);
        this.checkTicker = null;
        this.checkGraphics.clear();
    }
    async ring(square, color, duration) {
        const g = new PIXI.Graphics();
        this.effectContainer.addChild(g);
        try {
            await animate(this, this.board.app.ticker, duration, t => {
                const center = this.squareCenter(square);
                g.clear().circle(center.x, center.y, 5 + t * 40)
                    .stroke({ width: 3, color, alpha: 1 - t });
            });
        } finally {
            if (!g.destroyed) g.destroy();
        }
    }
    playCapture(square) { return this.ring(square, 0xff3333, 300); }
    playPromotion(square) { return this.ring(square, 0xffd700, 500); }
    ping(square) { return this.ring(square, 0xffff00, 400); }
    playVictory() {
        return animate(this, this.board.app.ticker, 450, t => { this.alpha = t; });
    }
    clear() {
        this.clearCheck();
        cancelAnimations(this);
        this.alpha = 1;
        this.effectContainer.removeChildren().forEach(child => child.destroy({ children: true }));
    }
    destroy(options) {
        this.clear();
        super.destroy({ ...options, children: true });
    }
}

