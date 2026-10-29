import * as PIXI from "pixi.js";
import PieceFactory from "../pieces/PieceFactory.js";

export default class PieceLayer extends PIXI.Container {

    constructor(board) {

        super();

        this.board = board;

        // pieceId -> PieceSprite
        this.pieces = new Map();

    }

    //--------------------------------------------------
    // Update board from Python state
    //--------------------------------------------------

    updatePieces(pieceList) {

        if (!pieceList)
            return;

        const alive = new Set();

        //--------------------------------------------
        // Create / Update
        //--------------------------------------------

        pieceList.forEach(piece => {

            const id = piece.id ??
                `${piece.color}_${piece.type}_${piece.square}`;

            alive.add(id);

            if (this.pieces.has(id)) {

                const sprite = this.pieces.get(id);

                PieceFactory.update(sprite, piece);

            }
            else {

                const sprite =
                    PieceFactory.create(piece, this.board);

                this.pieces.set(id, sprite);

                this.addChild(sprite);

            }

        });

        //--------------------------------------------
        // Remove captured pieces
        //--------------------------------------------

        for (const [id, sprite] of this.pieces) {

            if (!alive.has(id)) {

                sprite.destroy();

                this.removeChild(sprite);

                this.pieces.delete(id);

            }

        }

        this.sortPieces();

    }

    //--------------------------------------------------
    // Find Piece
    //--------------------------------------------------

    getPiece(id) {

        return this.pieces.get(id);

    }

    //--------------------------------------------------

    getPieceAt(square) {

        for (const sprite of this.pieces.values()) {

            if (sprite.square === square)
                return sprite;

        }

        return null;

    }

    //--------------------------------------------------
    // Animation
    //--------------------------------------------------

    async animateMove(move) {

        if (move.isHoanQuan) return this.animateSwap(move);
        const sprite = this.pieces.get(move.id) ?? this.getPieceAt(move.from);

        if (!sprite)
            return;

        //---------------------------------------

        if (move.capture) {

            const target =
                this.getPieceAt(move.to);

            if (target) {

                await target.playCaptureAnimation();
                if (target.destroyed || sprite.destroyed) return;

                this.removeChild(target);

                for (const [id, piece] of this.pieces) {
                    if (piece === target) this.pieces.delete(id);
                }
                target.destroy();

            }

        }

        //---------------------------------------

        if (sprite.destroyed) return;
        await sprite.moveTo(move.to);
        if (sprite.destroyed) return;

        sprite.square = move.to;

        //---------------------------------------

        if (move.promotion) {

            sprite.updatePiece({

                ...sprite,

                type: move.promotion,

                promoted: true

            });

            PieceFactory.applyTexture(sprite);
            await sprite.playPromotionAnimation();

        }

    }

    //--------------------------------------------------
    // Hoan Quan
    //--------------------------------------------------

    async animateSwap(move) {

        const than =
            this.getPieceAt(move.from);

        const voi =
            this.getPieceAt(move.to);

        if (!than || !voi)
            return;

        const s1 = than.square;

        const s2 = voi.square;

        await Promise.all([

            than.moveTo(s2),

            voi.moveTo(s1)

        ]);

    }

    //--------------------------------------------------
    // Check
    //--------------------------------------------------

    showCheck(square) {

        const sprite =
            this.getPieceAt(square);

        if (!sprite)
            return;

        sprite.playCheckAnimation();

    }

    //--------------------------------------------------
    // Selected
    //--------------------------------------------------

    select(square) {

        this.clearSelection();

        const sprite =
            this.getPieceAt(square);

        if (sprite)
            sprite.setSelected(true);

    }

    clearSelection() {

        for (const sprite of this.pieces.values()) {

            sprite.setSelected(false);

        }

    }

    //--------------------------------------------------
    // Glow
    //--------------------------------------------------

    glow(square, enable = true) {

        const sprite =
            this.getPieceAt(square);

        if (!sprite)
            return;

        sprite.setGlow(enable);

    }

    //--------------------------------------------------
    // Z-Order
    //--------------------------------------------------

    bringToFront(sprite) {

        if (!sprite)
            return;

        this.removeChild(sprite);

        this.addChild(sprite);

    }

    //--------------------------------------------------

    sortPieces() {

        const list =
            [...this.children];

        list.sort((a, b) => {

            return a.y - b.y;

        });

        list.forEach(s => {

            this.addChild(s);

        });

    }

    //--------------------------------------------------
    // Resize
    //--------------------------------------------------

    resize() {

        for (const sprite of this.pieces.values()) {

            PieceFactory.update(sprite, sprite);

        }

    }

    //--------------------------------------------------
    // Clear
    //--------------------------------------------------

    clear() {

        for (const sprite of this.pieces.values()) {

            sprite.destroy();

        }

        this.removeChildren();

        this.pieces.clear();

    }

    //--------------------------------------------------

    destroy(options) {

        this.clear();

        super.destroy(options);

    }

}
