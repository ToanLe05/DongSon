import * as PIXI from "pixi.js";

export default class HighlightLayer extends PIXI.Container {

    constructor(board) {

        super();

        this.board = board;

        //----------------------------------------
        // Graphics
        //----------------------------------------

        this.lastMoveGraphics = new PIXI.Graphics();

        this.selectionGraphics = new PIXI.Graphics();

        this.legalMoveGraphics = new PIXI.Graphics();

        this.hoverGraphics = new PIXI.Graphics();

        //----------------------------------------

        this.addChild(this.lastMoveGraphics);

        this.addChild(this.selectionGraphics);

        this.addChild(this.legalMoveGraphics);

        this.addChild(this.hoverGraphics);

    }

    //-------------------------------------------------------
    // Utility
    //-------------------------------------------------------

    squareCenter(square){

        const {row,col} = this.board.squareToCoord(square);

        const cs = this.board.cellSize;

        return{

            x:col*cs + cs/2,

            y:(8-row)*cs + cs/2

        };

    }

    squareRect(square){

        const {row,col} = this.board.squareToCoord(square);

        const cs = this.board.cellSize;

        return{

            x:col*cs,

            y:(8-row)*cs,

            size:cs

        };

    }

    //-------------------------------------------------------
    // Selected
    //-------------------------------------------------------

    showSelection(square){

        this.selectionGraphics.clear();

        const r = this.squareRect(square);

        this.selectionGraphics

            .roundRect(

                r.x+2,

                r.y+2,

                r.size-4,

                r.size-4,

                8

            )

            .stroke({

                width:4,

                color:0xFFD54F

            });

    }

    clearSelection(){

        this.selectionGraphics.clear();

    }

    //-------------------------------------------------------
    // Legal moves
    //-------------------------------------------------------

    showLegalMoves(moves){

        this.legalMoveGraphics.clear();

        const cs = this.board.cellSize;

        moves.forEach(move=>{

            const square = move.to || move.end;

            const p = this.squareCenter(square);

            //----------------------------------

            if(move.capture){

                this.legalMoveGraphics

                    .circle(

                        p.x,

                        p.y,

                        cs*0.28

                    )

                    .stroke({

                        width:3,

                        color:0xDD3333

                    });

            }

            else{

                this.legalMoveGraphics

                    .fill({

                        color:0x444444,

                        alpha:0.45

                    })

                    .circle(

                        p.x,

                        p.y,

                        cs*0.10

                    )

                    .fill();

            }

        });

    }

    clearLegalMoves(){

        this.legalMoveGraphics.clear();

    }

    //-------------------------------------------------------
    // Last move
    //-------------------------------------------------------

    showLastMove(from,to){

        this.lastMoveGraphics.clear();

        this.drawLastSquare(from);

        this.drawLastSquare(to);

    }

    drawLastSquare(square){

        const r = this.squareRect(square);

        this.lastMoveGraphics

            .fill({

                color:0xFFE082,

                alpha:0.45

            })

            .roundRect(

                r.x,

                r.y,

                r.size,

                r.size,

                4

            )

            .fill();

    }

    clearLastMove(){

        this.lastMoveGraphics.clear();

    }

    //-------------------------------------------------------
    // Hover
    //-------------------------------------------------------

    showHover(square){

        this.hoverGraphics.clear();

        const r = this.squareRect(square);

        this.hoverGraphics

            .roundRect(

                r.x+1,

                r.y+1,

                r.size-2,

                r.size-2,

                5

            )

            .stroke({

                width:2,

                color:0x42A5F5,

                alpha:0.8

            });

    }

    clearHover(){

        this.hoverGraphics.clear();

    }

    //-------------------------------------------------------
    // Reset
    //-------------------------------------------------------

    clear(){

        this.clearSelection();

        this.clearLegalMoves();

        this.clearLastMove();

        this.clearHover();

    }

}