import { animate } from "./Animation.js";

export default class MoveAnimation {
    static easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    static async move(sprite, board, toSquare, duration = 250, height = 0) {
        const startX = sprite.x, startY = sprite.y;
        const { row, col } = board.squareToCoord(toSquare);
        const p = board.boardToScreen(row, col);
        const x = p.x + board.cellSize / 2, y = p.y + board.cellSize / 2;
        const completed = await animate(sprite, board.app.ticker, duration, t => {
            const e = this.easeInOutCubic(t);
            sprite.position.set(startX + (x - startX) * e,
                startY + (y - startY) * e - Math.sin(Math.PI * t) * height);
        });
        if (completed) {
            sprite.position.set(x, y);
            sprite.square = toSquare;
        }
    }
    static jump(sprite, board, square, height = 18, duration = 300) {
        return this.move(sprite, board, square, duration, height);
    }
    static fadeOut(sprite, board, duration = 180) {
        return animate(sprite, board.app.ticker, duration, t => { sprite.alpha = 1 - t; });
    }
    static fadeIn(sprite, board, duration = 180) {
        sprite.alpha = 0;
        return animate(sprite, board.app.ticker, duration, t => { sprite.alpha = t; });
    }
    static pulse(sprite, board, scale = 1.15, duration = 180) {
        return animate(sprite, board.app.ticker, duration, t => {
            sprite.scale.set(t === 1 ? 1 : 1 + Math.sin(Math.PI * t) * (scale - 1));
        });
    }
    static capture(attacker, victim, board, toSquare) {
        return Promise.all([this.move(attacker, board, toSquare, 220), this.fadeOut(victim, board)]);
    }
    static swap(a, b, board) {
        return Promise.all([this.move(a, board, b.square), this.move(b, board, a.square)]);
    }
    static promotion(sprite, board) { return this.pulse(sprite, board, 1.3, 300); }
}

