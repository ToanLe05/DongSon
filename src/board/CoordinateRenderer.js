import * as PIXI from "pixi.js";
import { BOARD_FONT } from "../theme/fonts.js";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h", "k"];

export default class CoordinateRenderer {

    constructor(board) {

        this.board = board;

        this.container = board.gridLayer;

        this.fileTexts = [];

        this.rankTexts = [];

    }

    //---------------------------------------------------------
    // Draw
    //---------------------------------------------------------

    draw() {

        this.clear();

        this.drawFiles();

        this.drawRanks();

    }

    //---------------------------------------------------------
    // Files (a → k)
    //---------------------------------------------------------

    drawFiles() {

        const cs = this.board.cellSize;

        for (let col = 0; col < 9; col++) {

            const text = new PIXI.Text({

                text: FILES[col],

                style: {

                    fontFamily: BOARD_FONT,

                    fontSize: Math.max(12, Math.round(cs * 0.22)),

                    fontWeight: "bold",

                    fill: "#e3bd6f",

                    align: "center"

                }

            });

            text.anchor.set(0.5);

            text.x = col * cs + cs / 2;

            text.y = this.board.heightPx + cs * 0.28;

            this.container.addChild(text);

            this.fileTexts.push(text);

        }

    }

    //---------------------------------------------------------
    // Ranks (9 → 1)
    //---------------------------------------------------------

    drawRanks() {

        const cs = this.board.cellSize;

        for (let row = 0; row < 9; row++) {

            const text = new PIXI.Text({

                text: String(9 - row),

                style: {

                    fontFamily: BOARD_FONT,

                    fontSize: Math.max(12, Math.round(cs * 0.22)),

                    fontWeight: "bold",

                    fill: "#e3bd6f",

                    align: "center"

                }

            });

            text.anchor.set(0.5);

            text.x = -cs * 0.25;

            text.y = row * cs + cs / 2;

            this.container.addChild(text);

            this.rankTexts.push(text);

        }

    }

    //---------------------------------------------------------
    // Remove
    //---------------------------------------------------------

    clear() {

        this.fileTexts.forEach(t => {

            this.container.removeChild(t);

            t.destroy();

        });

        this.rankTexts.forEach(t => {

            this.container.removeChild(t);

            t.destroy();

        });

        this.fileTexts = [];

        this.rankTexts = [];

    }

    //---------------------------------------------------------
    // Resize
    //---------------------------------------------------------

    resize() {

        this.draw();

    }

    //---------------------------------------------------------
    // Theme
    //---------------------------------------------------------

    setVisible(value = true) {

        this.fileTexts.forEach(t => t.visible = value);

        this.rankTexts.forEach(t => t.visible = value);

    }

}
