import * as PIXI from "pixi.js";

import PalaceRenderer from "./PalaceRenderer";

export default class ZoneLayer extends PIXI.Container {

    constructor(board) {

        super();

        this.board = board;

        //---------------------------------------------
        // Renderers
        //---------------------------------------------
        // Each renderer now owns its own PIXI.Container
        // (fixed: PalaceRenderer used to point at
        // `board.zoneLayer`, which is undefined at this point
        // in construction — that's what made draw()/highlight()/
        // pulse() throw on an undefined container).
        //---------------------------------------------

        this.palace = new PalaceRenderer(board);

        //---------------------------------------------

        this.addChild(this.palace.container);

    }

    //-------------------------------------------------
    // Draw all zones
    //-------------------------------------------------
    // Single owner of Palace + Water base + Mountain base.
    // GameBoard calls this once on init and again on resize.
    //-------------------------------------------------

    draw() {

        this.palace.draw();

    }

    //-------------------------------------------------
    // Resize
    //-------------------------------------------------

    resize() {

        this.draw();

    }

    //-------------------------------------------------
    // Theme
    //-------------------------------------------------

    setAlpha(alpha) {

        this.alpha = alpha;

    }

    //-------------------------------------------------
    // Palace shortcut
    //-------------------------------------------------

    pulsePalace() {

        this.palace.pulse();

    }

    highlightPalace(enable = true) {

        this.palace.highlight(enable);

    }

    //-------------------------------------------------
    // Visibility
    //-------------------------------------------------

    showPalace(show = true) {

        this.palace.container.visible = show;

    }

    //-------------------------------------------------
    // Destroy
    //-------------------------------------------------

    destroy(options) {

        this.palace.destroy?.();

        super.destroy(options);

    }

}