import { animate, cancelAnimations } from "../effects/Animation.js";
import * as PIXI from "pixi.js";

export default class BoardCell extends PIXI.Container {

    constructor(board, row, col) {

        super();

        this.board = board;

        this.row = row;
        this.col = col;

        this.square = board.squareName(row, col);

        this.size = board.cellSize;

        //---------------------------------------
        // State
        //---------------------------------------

        this.selected = false;
        this.hover = false;
        this.lastMove = false;
        this.inPalace = this.isPalace();

        //---------------------------------------
        // Graphics
        //---------------------------------------

        this.background = new PIXI.Graphics();

        this.overlay = new PIXI.Graphics();

        this.border = new PIXI.Graphics();

        this.addChild(this.background);
        this.addChild(this.overlay);
        this.addChild(this.border);

        //---------------------------------------

        this.position.set(
            col * this.size,
            (8 - row) * this.size
        );

        //---------------------------------------

        this.eventMode = "static";
        this.cursor = "pointer";

        this.on("pointerover", this.onHover.bind(this));

        this.on("pointerout", this.onOut.bind(this));

        this.on("pointertap", this.onClick.bind(this));

        //---------------------------------------

        this.draw();

    }

    //---------------------------------------------------------
    // Palace
    //---------------------------------------------------------

    isPalace() {

        return (
            this.row >= 3 &&
            this.row <= 5 &&
            this.col >= 3 &&
            this.col <= 5
        );

    }

    //---------------------------------------------------------
    // Draw
    //---------------------------------------------------------

    draw() {

        this.background.clear();

        this.border.clear();

        //------------------------------------

        let color =
            this.inPalace
                ? 0xD9C8A2
                : 0xF6E8C5;

        this.background
            .rect(
                0,
                0,
                this.size,
                this.size
            )
            .fill(color);

        //------------------------------------

        this.border
            .rect(
                0,
                0,
                this.size,
                this.size
            )
            .stroke({

                width: 1,

                color: 0x7A6248

            });

    }

    //---------------------------------------------------------
    // Hover
    //---------------------------------------------------------

    onHover() {

        this.hover = true;

        this.redrawOverlay();

        this.emit(
            "cell-hover",
            this.square
        );

    }

    onOut() {

        this.hover = false;

        this.redrawOverlay();

    }

    //---------------------------------------------------------
    // Click
    //---------------------------------------------------------

    onClick() {

        this.emit(

            "cell-click",

            this.square

        );

    }

    //---------------------------------------------------------
    // Selected
    //---------------------------------------------------------

    setSelected(value) {

        this.selected = value;

        this.redrawOverlay();

    }

    //---------------------------------------------------------
    // Last Move
    //---------------------------------------------------------

    setLastMove(value) {

        this.lastMove = value;

        this.redrawOverlay();

    }

    //---------------------------------------------------------
    // Hover Layer
    //---------------------------------------------------------

    redrawOverlay() {

        this.overlay.clear();

        //------------------------------------
        // Last move
        //------------------------------------

        if (this.lastMove) {

            this.overlay

                .rect(

                    0,

                    0,

                    this.size,

                    this.size

                )

                .fill({

                    color:0xFFD54F,

                    alpha:0.28

                });

        }

        //------------------------------------
        // Hover
        //------------------------------------

        if (this.hover) {

            this.overlay

                .rect(

                    0,

                    0,

                    this.size,

                    this.size

                )

                .fill({

                    color:0x42A5F5,

                    alpha:0.12

                });

        }

        //------------------------------------
        // Selected
        //------------------------------------

        if (this.selected) {

            this.overlay

                .rect(

                    2,

                    2,

                    this.size-4,

                    this.size-4

                )

                .stroke({

                    width:4,

                    color:0xFFD700

                });

        }

    }

    //---------------------------------------------------------
    // Flash
    //---------------------------------------------------------

    async flash(color = 0xFF0000) {
        const completed = await animate(this, this.board.app.ticker, 400, t => {
            this.overlay.clear().rect(0, 0, this.size, this.size)
                .fill({ color, alpha: 0.7 * (1 - t) });
        });
        if (completed) this.redrawOverlay();
    }

    //---------------------------------------------------------
    // Resize
    //---------------------------------------------------------

    resize(size){

        this.size=size;

        this.position.set(

            this.col*size,

            (8-this.row)*size

        );

        this.draw();

        this.redrawOverlay();

    }

    //---------------------------------------------------------

    destroy(options){

        cancelAnimations(this);
        super.destroy(options);

    }

}
