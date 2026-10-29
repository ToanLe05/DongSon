import * as PIXI from "pixi.js";

export default class WaterBaseRenderer{

    constructor(board){

        this.board = board;

        this.container = new PIXI.Container();

    }

    draw(){

        this.container.removeChildren();

        const cs = this.board.cellSize;

        const g = new PIXI.Graphics();

        const x = 4*cs + cs/2;

        const y = 8*cs + cs/2;

        g.ellipse(
            x,
            y,
            cs*0.14,
            cs*0.20
        );

        g.fill(0x6EC8FF);

        this.container.addChild(g);

    }

    destroy(){

        this.container.destroy({children:true});

    }

}