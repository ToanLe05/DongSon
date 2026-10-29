import ChoiceDialog from "../ui/ChoiceDialog.js";
import * as PIXI from "pixi.js";

import GridRenderer from "./GridRenderer";
import CoordinateRenderer from "./CoordinateRenderer";
import ZoneLayer from "./ZoneLayer";
import HighlightLayer from "./HighlightLayer";
import PieceLayer from "./PieceLayer";
import EffectLayer from "./EffectLayer";
import InputManager from "./InputManager";
import BoardCell from "./BoardCell";

export default class GameBoard extends PIXI.Container {

    constructor(app, options = {}) {
        super();

        this.app = app;

        //-------------------------------------------------
        // configuration
        //-------------------------------------------------

        this.cellSize = options.cellSize || 80;

        this.boardSize = 9;

        this.widthPx = this.boardSize * this.cellSize;
        this.heightPx = this.boardSize * this.cellSize;

        //-------------------------------------------------
        // state
        //-------------------------------------------------

        this.boardState = null;

        this.selectedSquare = null;

        this.legalMoves = [];

        this.lastMove = null;

        //-------------------------------------------------
        // layers
        //-------------------------------------------------

        this.backgroundLayer = new PIXI.Container();

        this.gridLayer = new PIXI.Container();

        this.zoneLayer = new ZoneLayer(this);

        this.cellLayer = new PIXI.Container();

        this.highlightLayer = new HighlightLayer(this);

        this.pieceLayer = new PieceLayer(this);

        this.effectLayer = new EffectLayer(this);

        this.inputLayer = new PIXI.Container();

        //-------------------------------------------------

        this.addChild(this.backgroundLayer);

        this.addChild(this.gridLayer);

        this.addChild(this.cellLayer);

        // Palace and e5 markings must remain above the opaque cell backgrounds.
        this.zoneLayer.eventMode = "none";
        this.addChild(this.zoneLayer);

        this.addChild(this.highlightLayer);

        this.addChild(this.pieceLayer);

        this.addChild(this.effectLayer);

        this.addChild(this.inputLayer);

        //-------------------------------------------------
        // render static board
        //-------------------------------------------------
        // Ownership, no overlap:
        //   GridRenderer       -> background + grid lines (gridLayer)
        //   ZoneLayer          -> palace + center ring + water/mountain bases
        //   CoordinateRenderer -> file/rank labels (gridLayer)
        //-------------------------------------------------

        this.gridRenderer = new GridRenderer(this);

        this.coordinateRenderer = new CoordinateRenderer(this);

        this.gridRenderer.draw();

        this.zoneLayer.draw();

        this.coordinateRenderer.draw();

        //-------------------------------------------------
        // cells
        //-------------------------------------------------
        // BoardCell handles hit-testing + hover/selected overlay for a
        // single square, and emits "cell-click" / "cell-hover" on itself.
        // Forwarded here so InputManager (which listens via
        // board.on("cell-click", ...)) actually receives them.
        //-------------------------------------------------

        this.cells = new Map();

        this.buildCells();

        //-------------------------------------------------
        // input
        //-------------------------------------------------

        this.inputManager = new InputManager(this);

        this.inputManager.enable();

    }

    //-------------------------------------------------
    // Cell grid
    //-------------------------------------------------

    buildCells() {

        for (let row = 0; row < 9; row++) {

            for (let col = 0; col < 9; col++) {

                const cell = new BoardCell(this, row, col);

                cell.on("cell-click", square => {

                    this.emit("cell-click", square);

                });

                cell.on("cell-hover", square => {

                    this.emit("cell-hover", square);

                });

                this.cellLayer.addChild(cell);

                this.cells.set(cell.square, cell);

            }

        }

    }

    //-------------------------------------------------

    getCell(square) {

        return this.cells.get(square) || null;

    }

    //-------------------------------------------------
    // Coordinate conversion
    //-------------------------------------------------

    boardToScreen(row, col) {

        return {

            x: col * this.cellSize,

            y: (8 - row) * this.cellSize

        };

    }

    screenToBoard(x, y) {

        return {

            row: 8 - Math.floor(y / this.cellSize),

            col: Math.floor(x / this.cellSize)

        };

    }

    //-------------------------------------------------
    // Update from Python
    //-------------------------------------------------

    updateBoard(state) {

        // Guard: the board can now be laid out / resized before a match
        // has started (boardState is still null at that point) — without
        // this, resize() -> updateBoard(null) -> state.pieces throws.
        if (!state)
            return;

        this.boardState = state;

        //----------------------------------------

        this.pieceLayer.updatePieces(state.pieces);

        //----------------------------------------

        if (state.lastMove) {

            this.highlightLayer.showLastMove(

                state.lastMove.from,

                state.lastMove.to

            );

        }

        //----------------------------------------

        if (!state.lastMove) this.highlightLayer.clearLastMove();

        if (state.check) {

            this.effectLayer.showCheck(

                state.checkSquare

            );

        }
        else {

            this.effectLayer.clearCheck();

        }

    }

    //-------------------------------------------------
    // Piece selection
    //-------------------------------------------------

    selectSquare(square) {

        this.selectedSquare = square;

        this.highlightLayer.showSelection(square);

    }

    clearSelection() {

        this.selectedSquare = null;

        this.highlightLayer.clearSelection();

    }

    //-------------------------------------------------
    // Legal moves
    //-------------------------------------------------

    showLegalMoves(moves) {

        this.legalMoves = moves;

        this.highlightLayer.showLegalMoves(moves);

    }

    clearLegalMoves() {

        this.legalMoves = [];

        this.highlightLayer.clearLegalMoves();

    }

    //-------------------------------------------------
    // Move animation
    //-------------------------------------------------

    animateMove(move) {

        return this.pieceLayer.animateMove(move);

    }

    //-------------------------------------------------
    // Promotion
    //-------------------------------------------------

    showPromotionDialog(moves) {
        this.promotionDialog ??= new ChoiceDialog();
        const names = { Ngua: "Ngựa", Voi: "Voi", Ga: "Gà" };
        const side = this.boardState?.turn === "son" ? "Sơn Tinh" : "Thủy Tinh";
        return this.promotionDialog.open({
            title: `Chọn quân phong cấp — ${side}`,
            description: `${moves[0].from} → ${moves[0].to}. Chọn một quân; Hủy hoặc Escape giữ nguyên thế cờ và lượt đi.`,
            className: "promotion-dialog",
            choices: [...new Set(moves.map(move => move.promotion).filter(Boolean))]
                .map(value => ({ value, label: names[value] ?? value })),
        });
    }

    cancelPromotionDialog() { this.promotionDialog?.cancel(); }

    //-------------------------------------------------
    // Reset
    //-------------------------------------------------

    resetBoard() {
        this.cancelPromotionDialog();
        this.inputManager.clearSelection();

        this.clearSelection();

        this.clearLegalMoves();

        this.highlightLayer.clearLastMove();

        this.effectLayer.clear();

        this.pieceLayer.clear();

        this.boardState = null;

    }

    //-------------------------------------------------
    // Utility
    //-------------------------------------------------

    squareName(row, col) {

        const files = ["a","b","c","d","e","f","g","h","k"];

        return files[col] + (row + 1);

    }

    squareToCoord(square) {

        const files = ["a","b","c","d","e","f","g","h","k"];

        const col = files.indexOf(square[0]);

        const row = parseInt(square.substring(1)) - 1;

        return {

            row,

            col

        };

    }

    //-------------------------------------------------
    // Resize
    //-------------------------------------------------

    resize(cellSize) {

        this.cellSize = cellSize;

        this.widthPx = cellSize * 9;

        this.heightPx = cellSize * 9;

        this.gridRenderer.draw();

        this.zoneLayer.draw();

        this.coordinateRenderer.draw();

        this.cells.forEach(cell => cell.resize(cellSize));

        this.updateBoard(this.boardState);

        if (this.selectedSquare) this.highlightLayer.showSelection(this.selectedSquare);
        if (this.legalMoves?.length) this.highlightLayer.showLegalMoves(this.legalMoves);

    }

    destroy(options) {
        this.inputManager.destroy();
        this.effectLayer.clear();
        this.pieceLayer.clear();
        super.destroy({ ...options, children: true });
    }
}

