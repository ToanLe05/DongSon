import { animate, cancelAnimations } from "../effects/Animation.js";
import { getAssetTexture } from "../assets.js";
import * as PIXI from "pixi.js";

export default class PalaceRenderer {

    constructor(board) {

        this.board = board;

        // Own container, added into ZoneLayer by ZoneLayer itself.
        // (Previously this was `board.zoneLayer`, which is undefined
        // at construction time since ZoneLayer hasn't finished being
        // assigned to board.zoneLayer yet — that circular reference
        // caused draw()/highlight()/pulse() to throw on an undefined
        // container.)
        this.container = new PIXI.Container();

        this.patternSprite = null;

    }

    //---------------------------------------------------------
    // Draw Palace
    //---------------------------------------------------------

    draw() {

        this.container.removeChildren().forEach(child => child.destroy({ children: true }));
        this.patternSprite = null;

        this.drawPalaceArea();

        this.drawDongSonPattern();

        this.drawCenterCircle();

    }

    //---------------------------------------------------------
    // Palace Background
    //---------------------------------------------------------

    drawPalaceArea() {

        const cs = this.board.cellSize;

        const palace = new PIXI.Graphics();

        palace.roundRect(
            3 * cs,
            3 * cs,
            3 * cs,
            3 * cs,
            cs * 0.15
        );

        palace.fill({
            color: 0xD6C19C,
            alpha: 0.28
        });

        palace.stroke({
            color: 0x8C6239,
            width: 2,
            alpha: 0.55
        });

        this.container.addChild(palace);

    }

    //---------------------------------------------------------
    // Dong Son Pattern
    //---------------------------------------------------------

    drawDongSonPattern() {

        const cs = this.board.cellSize;

        //-----------------------------------------
        // Nếu chưa có asset thì bỏ qua
        //-----------------------------------------

        try {

            const texture = getAssetTexture("board/dongson_pattern.jpg");
            if (!texture) return;

            this.patternSprite = new PIXI.TilingSprite({

                texture,

                width: 3 * cs,

                height: 3 * cs

            });

            this.patternSprite.x = 3 * cs;

            this.patternSprite.y = 3 * cs;

            this.patternSprite.alpha = 0.10;

            //-------------------------------------
            // Mask
            //-------------------------------------

            const mask = new PIXI.Graphics();

            mask.rect(
                3 * cs,
                3 * cs,
                3 * cs,
                3 * cs
            );

            mask.fill(0xffffff);

            this.container.addChild(mask);

            this.patternSprite.mask = mask;

            this.container.addChild(this.patternSprite);

        }
        catch(e){

            console.warn(
                "dongson_pattern.png not found."
            );

        }

    }

    //---------------------------------------------------------
    // e5
    //---------------------------------------------------------

    drawCenterCircle() {

        const cs = this.board.cellSize;

        const centerX = 4 * cs + cs / 2;

        const centerY = 4 * cs + cs / 2;

        //-------------------------------------

        const outer = new PIXI.Graphics();

        outer.circle(

            centerX,

            centerY,

            cs * 0.24

        );

        outer.stroke({

            color: 0xB27D33,

            width: 4

        });

        this.container.addChild(outer);

        //-------------------------------------

        const inner = new PIXI.Graphics();

        inner.circle(

            centerX,

            centerY,

            cs * 0.08

        );

        inner.fill({

            color: 0xB27D33,

            alpha: 0.7

        });

        this.container.addChild(inner);

    }

    //---------------------------------------------------------
    // Highlight Palace
    //---------------------------------------------------------

    highlight(enable = true) {

        this.container.alpha = enable ? 1 : 0.45;

    }

    //---------------------------------------------------------
    // Pulse Animation
    //---------------------------------------------------------

    pulse() {
        cancelAnimations(this);
        return animate(this, this.board.app.ticker, 800, t => {
            this.container.alpha = t === 1 ? 1 : 0.82 + Math.sin(t * Math.PI * 4) * 0.18;
        });
    }

    destroy() {
        cancelAnimations(this);
        this.container.destroy({ children: true });
    }

    //---------------------------------------------------------
    // Resize
    //---------------------------------------------------------

    resize() {

        this.draw();

    }

}
