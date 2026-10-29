import * as PIXI from "pixi.js";

export default class MountainBaseRenderer{

    constructor(board){

        this.board = board;

        this.container = new PIXI.Container();

    }

    draw(){

        this.container.removeChildren();

        const cs = this.board.cellSize;

        const x = 4*cs + cs/2;

        const y = cs/2;

        const g = new PIXI.Graphics();

        g.poly([

            x,
            y-cs*0.18,

            x-cs*0.18,
            y+cs*0.15,

            x+cs*0.18,
            y+cs*0.15

        ]);

        g.fill(0x444444);

        this.container.addChild(g);

    }

    destroy(){

        this.container.destroy({children:true});

    }

}