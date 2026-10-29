import { animate, cancelAnimations } from "../effects/Animation.js";
import * as PIXI from "pixi.js";
import { BOARD_FONT } from "../theme/fonts.js";

export default class PieceSprite extends PIXI.Container {

    constructor(piece, board) {

        super();

        this.board = board;

        this.id = piece.id ?? null;

        this.type = piece.type;

        this.color = piece.color;

        this.promoted = piece.promoted ?? false;

        this.frozen = piece.frozen ?? false;

        this.enteredPalace = piece.enteredPalace ?? false;

        this.square = piece.square;

        // Not interactive on purpose: BoardCell is the single source of
        // truth for clicks/hover. Pieces have no listeners of their own,
        // but `interactive = true` still makes them hit-testable, which
        // would swallow pointer events aimed at the BoardCell underneath
        // (a piece's square would become unclickable).
        this.eventMode = "none";

        this.cursor = "pointer";

        //---------------------------------------
        // Shadow
        //---------------------------------------

        this.shadow = new PIXI.Graphics();

        this.shadow.ellipse(0, 4, 24, 8);

        this.shadow.fill({
            color: 0x000000,
            alpha: 0.18
        });

        this.addChild(this.shadow);

        //---------------------------------------
        // Body
        //---------------------------------------

        this.body = this.createPieceBody();

        this.addChild(this.body);

        //---------------------------------------
        // Label
        //---------------------------------------

        this.pieceLabel = new PIXI.Text({

            text: this.typeLetter(),

            style: {

                fontFamily: BOARD_FONT,

                fontWeight: "bold",

                fontSize: 24,

                fill: this.color === "thuy"
                    ? "#1565C0"
                    : "#5D4037"

            }

        });

        this.pieceLabel.anchor.set(0.5);

        this.addChild(this.pieceLabel);

        //---------------------------------------
        // Decoration
        //---------------------------------------

        this.statusLayer = new PIXI.Container();

        this.addChild(this.statusLayer);

        //---------------------------------------

        this.updateStatus();

    }

    //----------------------------------------------------
    // Piece Shape
    //----------------------------------------------------

    createPieceBody() {

        const g = new PIXI.Graphics();

        g.circle(0, 0, 28);

        g.fill(0xF6E8C6);

        g.stroke({

            width: 3,

            color: 0x8D6E63

        });

        return g;

    }

    //----------------------------------------------------

    typeLetter() {

        const map = {

            Than: "神",

            Lac: "L",

            Bo: "B",

            Dinh: "Đ",

            Ngua: "N",

            Voi: "V",

            Ga: "G"

        };

        return map[this.type] || "?";

    }

    //----------------------------------------------------
    // Board Position
    //----------------------------------------------------

    setBoardPosition(square) {

        this.square = square;

        const { row, col } =
            this.board.squareToCoord(square);

        const p =
            this.board.boardToScreen(row, col);

        this.position.set(

            p.x + this.board.cellSize / 2,

            p.y + this.board.cellSize / 2

        );

    }

    //----------------------------------------------------

    async moveTo(square, duration = 200) {
        const startX = this.x, startY = this.y;
        const { row, col } = this.board.squareToCoord(square);
        const p = this.board.boardToScreen(row, col);
        const completed = await animate(this, this.board.app.ticker, duration, t => {
            this.position.set(startX + (p.x + this.board.cellSize / 2 - startX) * t,
                startY + (p.y + this.board.cellSize / 2 - startY) * t);
        });
        if (completed) this.setBoardPosition(square);
    }

    //----------------------------------------------------
    // Selected
    //----------------------------------------------------

    setSelected(selected) {

        this.scale.set(selected ? 1.1 : 1);

    }

    //----------------------------------------------------
    // Glow
    //----------------------------------------------------

    setGlow(enable) {

        this.alpha = enable ? 0.85 : 1;

    }

    //----------------------------------------------------
    // Check
    //----------------------------------------------------

    playCheckAnimation() {
        return animate(this, this.board.app.ticker, 700, t => {
            this.scale.set(1 + 0.06 * Math.sin(t * Math.PI * 8));
        });
    }
    playCaptureAnimation() {
        return animate(this, this.board.app.ticker, 180, t => {
            this.scale.set(1 - t);
            this.alpha = 1 - t;
        });
    }
    playPromotionAnimation() {
        return animate(this, this.board.app.ticker, 350, t => {
            this.rotation = t === 1 ? 0 : Math.sin(t * Math.PI * 4) * 0.15;
        });
    }

    //----------------------------------------------------
    // Update Piece State
    //----------------------------------------------------

    updatePiece(piece) {

        this.type = piece.type;

        this.promoted = piece.promoted;

        this.frozen = piece.frozen;

        this.enteredPalace =
            piece.enteredPalace;

        this.pieceLabel.text =
            this.typeLetter();

        this.updateStatus();

    }

    //----------------------------------------------------
    // Status Icons
    //----------------------------------------------------

    updateStatus() {

        this.statusLayer.removeChildren().forEach(child => child.destroy());

        if (this.promoted) {

            const star = new PIXI.Graphics();

            star.star(

                22,

                -22,

                5,

                8

            );

            star.fill(0xFFD54F);

            this.statusLayer.addChild(star);

        }

        if (this.frozen) {

            const ice = new PIXI.Graphics();

            ice.circle(-22, -22, 6);

            ice.fill(0x81D4FA);

            this.statusLayer.addChild(ice);

        }

    }

    //----------------------------------------------------
    // Destroy
    //----------------------------------------------------

    destroy(options) {

        cancelAnimations(this);
        super.destroy({ ...options, children: true });

    }

}
