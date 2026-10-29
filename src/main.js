import { Application } from "pixi.js";

import GameBoard from "./board/GameBoard.js";
import ApiClient from "./network/ApiClient.js";
import LocalClient from "./local/LocalClient.js";
import GameSync from "./network/GameSync.js";
import MatchController from "./ui/MatchController.js";
import { preloadAssets } from "./assets.js";

const CELL_MARGIN_PX = 48;   // breathing room around the board
const MIN_CELL_SIZE = 28;

// --------------------------------------------------------------------- //
// Boot Pixi
// --------------------------------------------------------------------- //

const app = new Application();

await app.init({
    resizeTo: document.getElementById("canvas-root"),
    background: 0x000000,
    backgroundAlpha: 0,      // let the CSS radial patina gradient show through
    antialias: true,
});
app.ticker.maxFPS = 30;

document.getElementById("canvas-root").appendChild(app.canvas);

await preloadAssets();

const board = new GameBoard(app, { cellSize: computeCellSize() });
app.stage.addChild(board);

centerBoard();

app.renderer.on("resize", () => {
    board.resize(computeCellSize());
    centerBoard();
});

function computeCellSize() {
    const w = app.screen.width;
    const h = app.screen.height;
    const usable = Math.max(MIN_CELL_SIZE * 9, Math.min(w, h) - CELL_MARGIN_PX * 2);
    return Math.floor(usable / 9);
}

function centerBoard() {
    board.x = Math.round((app.screen.width - board.widthPx) / 2);
    board.y = Math.round((app.screen.height - board.heightPx) / 2);
}

// --------------------------------------------------------------------- //
// Python rules run in a dedicated worker. HTTP is only an explicit legacy/test mode.
// --------------------------------------------------------------------- //

const api = import.meta.env.VITE_ENGINE === "api"
    ? new ApiClient(import.meta.env.VITE_API_URL || "/api")
    : new LocalClient({ onProgress: message => {
        document.getElementById("status-line").textContent = message;
    } });
const gameSync = new GameSync(board, api);

const match = new MatchController(board, gameSync);
const rulesDialog = document.getElementById("rules-dialog");
const rulesButton = document.getElementById("btn-rules");
const openRules = () => rulesDialog.showModal();
rulesButton.addEventListener("click", openRules);
const restoreOnReturn = () => {
    if (document.visibilityState === "hidden") {
        app.stop();
        return;
    }
    app.start();
    if (!match.busy && !gameSync.isBusy() && !board.inputManager.busy) void match.restore();
};
document.addEventListener("visibilitychange", restoreOnReturn);
const controlsObserver = new ResizeObserver(entries => {
    const height = entries[0].target.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--controls-height", `${Math.ceil(height + 40)}px`);
    app.resize();
});
controlsObserver.observe(document.getElementById("control-bar"));
await match.restore();
if (api.notice) document.getElementById("action-message").textContent = api.notice;

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        rulesButton.removeEventListener("click", openRules);
        document.removeEventListener("visibilitychange", restoreOnReturn);
        rulesDialog.close();
        controlsObserver.disconnect();
        match.destroy();
        api.destroy?.();
        app.destroy({ removeView: true }, { children: true });
    });
}

