import { deltaMS, cancelAnimations } from "./Animation.js";
import * as PIXI from "pixi.js";

export default class PingEffect extends PIXI.Container {

    constructor(app, options = {}) {

        super();

        this.app = app;

        //----------------------------------------
        // Config
        //----------------------------------------

        this.color = options.color ?? 0xFFD54F;

        this.lineWidth = options.lineWidth ?? 3;

        this.startRadius = options.startRadius ?? 8;

        this.endRadius = options.endRadius ?? 42;

        this.duration = options.duration ?? 600;

        this.maxAlpha = options.alpha ?? 0.85;

        //----------------------------------------

        this.graphics = new PIXI.Graphics();

        this.addChild(this.graphics);

        this.visible = false;

        this.running = false;

    }

    //----------------------------------------------------
    // Play
    //----------------------------------------------------

    play(x, y) {

        if (this.running)
            return Promise.resolve();

        this.running = true;

        this.visible = true;

        this.position.set(x, y);

        let elapsed = 0;

        return new Promise(resolve => {

            const update = (delta) => {
                delta = deltaMS(delta) / (1000 / 60);

                elapsed += delta * 16;

                let t = elapsed / this.duration;

                if (t > 1)
                    t = 1;

                //----------------------------------
                // Ease Out Cubic
                //----------------------------------

                const ease =
                    1 - Math.pow(1 - t, 3);

                //----------------------------------

                const radius =
                    this.startRadius +
                    (this.endRadius - this.startRadius) * ease;

                const alpha =
                    this.maxAlpha * (1 - ease);

                //----------------------------------

                this.graphics.clear();

                //----------------------------------
                // Outer Ring
                //----------------------------------

                this.graphics

                    .circle(
                        0,
                        0,
                        radius
                    )

                    .stroke({

                        color: this.color,

                        width: this.lineWidth,

                        alpha

                    });

                //----------------------------------
                // Soft Fill
                //----------------------------------

                this.graphics

                    .circle(
                        0,
                        0,
                        radius * 0.65
                    )

                    .fill({

                        color: this.color,

                        alpha: alpha * 0.12

                    });

                //----------------------------------

                if (t >= 1) {

                    this.app.ticker.remove(update);

                    this.graphics.clear();

                    this.visible = false;

                    this.running = false;

                    this._animations.delete(cancel);
                    resolve();

                }

            };

            const cancel = () => {
                this.app.ticker.remove(update);
                this._animations.delete(cancel);
                resolve();
            };
            this._animations ??= new Set();
            this._animations.add(cancel);
            this.app.ticker.add(update);

        });

    }

    //----------------------------------------------------
    // Stop Immediately
    //----------------------------------------------------

    stop() {
        cancelAnimations(this);

        this.graphics.clear();

        this.visible = false;

        this.running = false;

    }

    //----------------------------------------------------
    // Convenience
    //----------------------------------------------------

    async playAtSquare(board, square) {

        const { row, col } =
            board.squareToCoord(square);

        const p =
            board.boardToScreen(row, col);

        await this.play(

            p.x + board.cellSize / 2,

            p.y + board.cellSize / 2

        );

    }

    //----------------------------------------------------
    // Config
    //----------------------------------------------------

    setColor(color) {

        this.color = color;

    }

    setRadius(start, end) {

        this.startRadius = start;

        this.endRadius = end;

    }

    setDuration(duration) {

        this.duration = duration;

    }

    //----------------------------------------------------

    destroy(options) {

        this.stop();

        super.destroy(options);

    }

}
