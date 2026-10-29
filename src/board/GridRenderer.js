import * as PIXI from "pixi.js";

export default class GridRenderer {

    constructor(board) {

        this.board = board;

        this.container = new PIXI.Container();
        board.gridLayer.addChild(this.container);

    }

    //---------------------------------------------------------
    // Draw
    //---------------------------------------------------------
    // NOTE: This renderer only owns the plain board surface:
    // background and grid lines.
    // Palace / center ring / Water base / Mountain base -> ZoneLayer
    // (PalaceRenderer already draws the e5 center ring as part of the
    // palace/zone decoration, WaterBaseRenderer, MountainBaseRenderer).
    // File/rank labels -> CoordinateRenderer.
    // Keeping ownership single-source avoids double-drawing the same
    // visuals into the same container.
    //---------------------------------------------------------

    draw() {

        this.container.removeChildren().forEach(child => child.destroy({ children: true }));

        this.drawBackground();

        this.drawGrid();

    }

    //---------------------------------------------------------
    // Background
    //---------------------------------------------------------

    drawBackground() {

        const g = new PIXI.Graphics();

        g
            .roundRect(

                0,

                0,

                this.board.widthPx,

                this.board.heightPx,

                8

            )

            .fill(0xF4E5C3);

        this.container.addChild(g);

    }

    //---------------------------------------------------------
    // Grid lines
    //---------------------------------------------------------

    drawGrid() {

        const cs = this.board.cellSize;

        const g = new PIXI.Graphics();

        for (let i = 0; i <= 9; i++) {

            g.moveTo(0, i * cs);

            g.lineTo(9 * cs, i * cs);

        }

        for (let i = 0; i <= 9; i++) {

            g.moveTo(i * cs, 0);

            g.lineTo(i * cs, 9 * cs);

        }

        g.stroke({

            width: 2,

            color: 0x554433

        });

        this.container.addChild(g);

    }

    //---------------------------------------------------------
    // Resize
    //---------------------------------------------------------

    resize() {

        this.draw();

    }

}
