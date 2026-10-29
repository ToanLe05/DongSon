export default class MockApiClient {

    constructor() {

        this.state = this.createInitialState();

        this.history = [];

        this.redoStack = [];

    }

    //--------------------------------------------------
    // Initial Board
    //--------------------------------------------------

    createInitialState() {

        return {

            turn: "thuy",

            winner: null,

            check: false,

            checkSquare: null,

            lastMove: null,

            pieces: [

                {
                    id: "thuy_than",
                    type: "Than",
                    color: "thuy",
                    square: "e1",
                    promoted: false,
                    frozen: false
                },

                {
                    id: "son_than",
                    type: "Than",
                    color: "son",
                    square: "e9",
                    promoted: false,
                    frozen: false
                },

                {
                    id: "thuy_lac",
                    type: "Lac",
                    color: "thuy",
                    square: "d2"
                },

                {
                    id: "son_lac",
                    type: "Lac",
                    color: "son",
                    square: "d8"
                }

            ]

        };

    }

    //--------------------------------------------------

    async delay(ms = 200) {

        return new Promise(resolve => {

            setTimeout(resolve, ms);

        });

    }

    //--------------------------------------------------

    clone(obj) {

        return JSON.parse(

            JSON.stringify(obj)

        );

    }

    //--------------------------------------------------
    // Ping
    //--------------------------------------------------

    async ping() {

        await this.delay();

        return {

            ok: true

        };

    }

    //--------------------------------------------------
    // New Game
    //--------------------------------------------------

    async newGame() {

        await this.delay();

        this.state = this.createInitialState();

        this.history = [];

        this.redoStack = [];

        return this.clone(this.state);

    }

    //--------------------------------------------------

    async getState() {

        await this.delay();

        return this.clone(this.state);

    }

    //--------------------------------------------------
    // Legal Moves
    //--------------------------------------------------

    async getLegalMoves(square) {

        await this.delay(80);

        const piece = this.state.pieces.find(

            p => p.square === square

        );

        if (!piece)
            return [];

        //---------------------------------------
        // Dummy legal moves
        //---------------------------------------

        const file = square.charCodeAt(0);

        const rank = parseInt(square[1]);

        const result = [];

        if (rank < 9) {

            result.push({

                from: square,

                to: `${String.fromCharCode(file)}${rank + 1}`,

                capture: false

            });

        }

        if (file > 97) {

            result.push({

                from: square,

                to: `${String.fromCharCode(file - 1)}${rank}`,

                capture: false

            });

        }

        return result;

    }

    //--------------------------------------------------
    // Move
    //--------------------------------------------------

    async makeMove(move) {

        await this.delay(300);

        this.history.push(

            this.clone(this.state)

        );

        this.redoStack = [];

        //------------------------------------

        const piece = this.state.pieces.find(

            p => p.square === move.from

        );

        if (!piece)
            return this.clone(this.state);

        //------------------------------------
        // Capture
        //------------------------------------

        this.state.pieces =

            this.state.pieces.filter(

                p => p.square !== move.to

            );

        //------------------------------------

        piece.square = move.to;

        //------------------------------------

        this.state.turn =

            this.state.turn === "thuy"

                ? "son"

                : "thuy";

        //------------------------------------

        this.state.lastMove = {

            ...move,

            id: piece.id,

            color: piece.color,

            type: piece.type

        };

        //------------------------------------

        this.state.check = false;

        this.state.winner = null;

        //------------------------------------

        return this.clone(this.state);

    }

    //--------------------------------------------------
    // Undo
    //--------------------------------------------------

    async undo() {

        await this.delay();

        if (this.history.length === 0)

            return this.clone(this.state);

        this.redoStack.push(

            this.clone(this.state)

        );

        this.state =

            this.history.pop();

        return this.clone(this.state);

    }

    //--------------------------------------------------
    // Redo
    //--------------------------------------------------

    async redo() {

        await this.delay();

        if (this.redoStack.length === 0)

            return this.clone(this.state);

        this.history.push(

            this.clone(this.state)

        );

        this.state =

            this.redoStack.pop();

        return this.clone(this.state);

    }

    //--------------------------------------------------
    // AI
    //--------------------------------------------------

    async aiMove() {

        await this.delay(500);

        const pieces =

            this.state.pieces.filter(

                p => p.color === this.state.turn

            );

        if (pieces.length === 0)

            return this.clone(this.state);

        const piece = pieces[0];

        const moves =

            await this.getLegalMoves(

                piece.square

            );

        if (moves.length === 0)

            return this.clone(this.state);

        return this.makeMove(moves[0]);

    }

    //--------------------------------------------------
    // Replay
    //--------------------------------------------------

    async replay(step) {

        await this.delay();

        if (

            step < 0 ||

            step >= this.history.length

        ) {

            return this.clone(this.state);

        }

        return this.clone(

            this.history[step]

        );

    }

    //--------------------------------------------------
    // Save
    //--------------------------------------------------

    async saveGame() {

        await this.delay();

        localStorage.setItem(

            "dongson_mock_save",

            JSON.stringify(this.state)

        );

        return {

            success: true

        };

    }

    //--------------------------------------------------
    // Load
    //--------------------------------------------------

    async loadGame() {

        await this.delay();

        const json =

            localStorage.getItem(

                "dongson_mock_save"

            );

        if (!json)

            return this.clone(this.state);

        this.state = JSON.parse(json);

        return this.clone(this.state);

    }

    //--------------------------------------------------

    async resign() {

        await this.delay();

        this.state.winner =

            this.state.turn === "thuy"

                ? "son"

                : "thuy";

        return this.clone(this.state);

    }

    //--------------------------------------------------

    async offerDraw() {

        await this.delay();

        return {

            accepted: false

        };

    }

}