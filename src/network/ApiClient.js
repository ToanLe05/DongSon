// Legacy HTTP transport. The default web game uses LocalClient's Worker transport.
export default class ApiClient {

    constructor(baseURL = "/api") {

        this.baseURL = baseURL;

        this.timeout = 10000;

    }

    //-------------------------------------------------------
    // Generic Request
    //-------------------------------------------------------

    async request(endpoint, method = "GET", body = null) {

        const controller = new AbortController();

        const timer = setTimeout(() => {

            controller.abort();

        }, this.timeout);

        try {

            const options = {

                method,

                headers: {

                    "Content-Type": "application/json"

                },

                signal: controller.signal

            };

            if (body !== null) {

                options.body = JSON.stringify(body);

            }

            const response = await fetch(

                `${this.baseURL}${endpoint}`,

                options

            );

            clearTimeout(timer);

            if (!response.ok) {

                const payload = await response.json().catch(() => ({}));
                const detail = payload.detail;
                const error = new Error(typeof detail === "string" ? detail : detail?.message ?? `HTTP ${response.status}`);
                error.status = response.status;
                error.code = detail?.code;
                error.state = detail?.state;
                throw error;

            }

            return await response.json();

        }
        catch (err) {

            clearTimeout(timer);

            console.error(err);

            throw err;

        }

    }

    //-------------------------------------------------------
    // Health
    //-------------------------------------------------------

    async ping() {

        return this.request("/ping");

    }

    //-------------------------------------------------------
    // New Game
    //-------------------------------------------------------

    async newGame(config = {}) {

        return this.request(

            "/new_game",

            "POST",

            config

        );

    }

    //-------------------------------------------------------
    // Current State
    //-------------------------------------------------------

    async getState() {

        return this.request("/state");

    }

    //-------------------------------------------------------
    // Legal Moves
    //-------------------------------------------------------

    async getLegalMoves(square) {

        return this.request(

            "/legal_moves",

            "POST",

            {

                square

            }

        );

    }

    //-------------------------------------------------------
    // Move
    //-------------------------------------------------------

    async makeMove(move, context = {}) {

        return this.request(

            "/move",

            "POST",

            {
                ...move,
                ...context,
                promotion: ({ Ngua: "n", Voi: "v", Ga: "g" })[move.promotion] ?? move.promotion
            }

        );

    }

    //-------------------------------------------------------
    // Undo
    //-------------------------------------------------------

    async undo() {

        return this.request(

            "/undo",

            "POST"

        );

    }

    //-------------------------------------------------------
    // Redo
    //-------------------------------------------------------

    async redo() {

        return this.request(

            "/redo",

            "POST"

        );

    }

    //-------------------------------------------------------
    // AI Move
    //-------------------------------------------------------

    async aiMove(level = 1) {

        return this.request(

            "/ai_move",

            "POST",

            {

                level

            }

        );

    }

    //-------------------------------------------------------
    // Save
    //-------------------------------------------------------

    async saveGame(slot = 1) {

        return this.request(

            "/save",

            "POST",

            {

                slot

            }

        );

    }

    //-------------------------------------------------------
    // Load
    //-------------------------------------------------------

    async loadGame(slot = 1) {

        return this.request(

            "/load",

            "POST",

            {

                slot

            }

        );

    }

    //-------------------------------------------------------
    // Resign
    //-------------------------------------------------------

    async resign(context = {}) {

        return this.request(

            "/resign",

            "POST",
            context

        );

    }

    //-------------------------------------------------------
    // Draw Offer
    //-------------------------------------------------------

    offerDraw(context = {}) { return this.request("/draw", "POST", { ...context, action: "offer" }); }
    acceptDraw(color, context = {}) { return this.request("/draw", "POST", { ...context, action: "accept", color }); }
    declineDraw(color, context = {}) { return this.request("/draw", "POST", { ...context, action: "decline", color }); }
    claimFiftyMoveDraw(context = {}) { return this.request("/draw", "POST", { ...context, action: "claim_fifty" }); }

    //-------------------------------------------------------
    // Change Config
    //-------------------------------------------------------

    async updateConfig(config) {

        return this.request(

            "/config",

            "POST",

            config

        );

    }

    //-------------------------------------------------------
    // Replay
    //-------------------------------------------------------

    async replay(step) {

        return this.request(

            "/replay",

            "POST",

            {

                step

            }

        );

    }

}
