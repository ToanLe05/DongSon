import ChoiceDialog from "./ChoiceDialog.js";
import { describeState, isGameOver, otherSide, SIDE_NAME } from "./matchStatus.js";
import { readGameFile, downloadGameFile } from "./gameFiles.js";

export default class MatchController {
    constructor(board, sync, document = globalThis.document) {
        this.board = board;
        this.sync = sync;
        this.document = document;
        this.started = false;
        this.busy = false;
        this.config = { mode: "human_vs_human", humanColor: null, botId: null };
        this.botQueued = false;
        this.botTask = null;
        this.botFailedKey = null;
        this.idleWaiters = [];
        this.dialog = new ChoiceDialog(document);
        this.elements = Object.fromEntries([
            "btn-start", "btn-rematch", "btn-end", "btn-draw", "btn-accept-draw",
            "btn-decline-draw", "btn-claim-fifty", "draw-response", "status-line", "action-message", "canvas-root",
            "btn-save-game", "btn-load-game", "btn-export-game", "btn-import-game", "game-import", "file-controls",
            "match-setup", "mode-options", "side-options", "play-mode-label", "btn-retry-bot",
        ].map(id => [id, document.getElementById(id)]));
        this.cleanups = [];
        const bind = (id, action) => {
            const handler = () => action();
            this.elements[id].addEventListener("click", handler);
            this.cleanups.push(() => this.elements[id].removeEventListener("click", handler));
        };
        bind("btn-start", () => this.start());
        bind("btn-retry-bot", () => { this.botFailedKey = null; this.render(); });
        bind("btn-rematch", () => this.start());
        bind("btn-end", () => this.resign());
        bind("btn-draw", () => this.draw("offer"));
        bind("btn-accept-draw", () => this.draw("accept"));
        bind("btn-decline-draw", () => this.draw("decline"));
        bind("btn-claim-fifty", () => this.draw("claim"));
        bind("btn-save-game", () => this.save());
        bind("btn-load-game", () => this.load());
        bind("btn-export-game", () => this.exportFile());
        bind("btn-import-game", () => {
            this.elements["game-import"].value = "";
            this.elements["game-import"].click();
        });
        const importChanged = () => {
            const file = this.elements["game-import"].files[0];
            if (file) void this.importFile(file);
            this.elements["game-import"].value = "";
        };
        this.elements["game-import"].addEventListener("change", importChanged);
        this.cleanups.push(() => this.elements["game-import"].removeEventListener("change", importChanged));
        const setupChanged = () => this.render();
        this.elements["match-setup"].addEventListener("change", setupChanged);
        this.cleanups.push(() => this.elements["match-setup"].removeEventListener("change", setupChanged));
        this.cleanups.push(sync.on("state", state => {
            this.elements["action-message"].textContent = "";
            this.started = Boolean(state.started || state.movesPlayed > 0 || isGameOver(state) || state.drawOfferPending);
            if (state.matchConfig && this.started) {
                this.config = { ...state.matchConfig };
                for (const input of document.querySelectorAll('input[name="play-mode"]')) input.checked = input.value === this.config.mode;
                for (const input of document.querySelectorAll('input[name="human-side"]')) input.checked = input.value === (this.config.humanColor ?? "thuy");
            }
            this.render();
        }));
        this.cleanups.push(sync.on("busy", () => this.render()));
        const onBusy = () => this.render();
        const onError = error => { void this.recover(error); };
        board.on("input-busy", onBusy);
        board.on("input-error", onError);
        this.cleanups.push(() => board.off("input-busy", onBusy), () => board.off("input-error", onError));
        board.inputManager.setLegalMoveProvider(square => this.canControl(square) ? sync.getLegalMoves(square) : []);
        board.inputManager.setMoveProvider(move => this.canControl(move.from) ? sync.move(move) : undefined);
        this.render();
    }

    readConfig() {
        const bot = this.document.querySelector('input[name="play-mode"]:checked')?.value === "human_vs_bot";
        return { mode: bot ? "human_vs_bot" : "human_vs_human",
            humanColor: bot ? (this.document.querySelector('input[name="human-side"]:checked')?.value === "son" ? "son" : "thuy") : null,
            botId: bot ? "random" : null };
    }

    needsBot(state = this.sync.exportState()) {
        return this.started && state && !isGameOver(state) && this.config.mode === "human_vs_bot"
            && (state.turn !== this.config.humanColor || state.drawOfferPending === this.config.humanColor);
    }

    stateKey(state) { return `${state?.gameId}:${state?.revision}`; }

    canControl(square) {
        const state = this.sync.exportState();
        if (!this.started || !state || isGameOver(state) || this.needsBot(state)) return false;
        return this.config.mode !== "human_vs_bot" || state.pieces.some(piece => piece.square === square && piece.color === this.config.humanColor);
    }

    queueBot(state) {
        if (this.botQueued || this.botTask || this.sync.isBotBusy() || this.botFailedKey === this.stateKey(state)) return;
        const ticket = { key: this.stateKey(state), generation: this.sync.generation };
        this.botQueued = ticket;
        queueMicrotask(() => {
            if (this.botQueued !== ticket) return;
            this.botQueued = false;
            if (this.destroyed || !this.needsBot()) return;
            if (ticket.key !== this.stateKey(this.sync.exportState()) || ticket.generation !== this.sync.generation) return this.render();
            void this.playBot(ticket);
        });
    }

    currentBotTask() { return this.botTask && this.botTask.generation === this.sync.generation; }

    async playBot(ticket) {
        if (this.busy || this.sync.isBusy() || this.sync.isBotBusy() || this.board.inputManager.busy) return;
        this.botTask = ticket;
        this.render();
        try { await this.sync.aiMove(); }
        catch (error) {
            while (!this.destroyed && this.busy) await new Promise(resolve => this.idleWaiters.push(resolve));
            if (this.destroyed || ticket.generation !== this.sync.generation) return;
            this.botFailedKey = ticket.key;
            await this.recover(error);
        } finally {
            if (this.botTask === ticket) this.botTask = null;
            this.render();
        }
    }

    render() {
        if (this.destroyed) return;
        const state = this.sync.exportState();
        const over = isGameOver(state);
        const active = this.started && Boolean(state) && !over;
        const pending = active && state.drawOfferPending;
        const blocked = this.busy || this.sync.isBusy() || this.board.inputManager.busy || Boolean(this.currentBotTask());
        const botTurn = this.needsBot(state);
        const botFailed = botTurn && this.botFailedKey === this.stateKey(state);
        const el = this.elements;
        el["canvas-root"].setAttribute("aria-busy", String(Boolean(blocked || (botTurn && !botFailed))));
        el["status-line"].textContent = this.started ? (botTurn && !botFailed ? "Bot đang nghĩ…" : describeState(state)) : "Chọn cách chơi rồi bấm Bắt đầu trận đấu.";
        el["match-setup"].hidden = this.started && !over;
        const selected = this.readConfig();
        el["side-options"].hidden = selected.mode !== "human_vs_bot";
        el["mode-options"].disabled = blocked || active;
        el["side-options"].disabled = blocked || active || selected.mode !== "human_vs_bot";
        const displayed = this.started ? this.config : selected;
        el["play-mode-label"].textContent = displayed.mode === "human_vs_bot"
            ? `Chơi với bot · Bạn: ${SIDE_NAME[displayed.humanColor]} · Bot: ${SIDE_NAME[otherSide(displayed.humanColor)]} · Thủy đi trước`
            : "Hai người · Cùng thiết bị · Thủy đi trước";
        el["btn-retry-bot"].hidden = !botFailed;
        el["btn-retry-bot"].disabled = blocked;
        el["btn-start"].hidden = this.started;
        el["btn-rematch"].hidden = !over;
        el["btn-start"].disabled = blocked;
        el["btn-rematch"].disabled = blocked;
        el["file-controls"].hidden = !this.sync.api.supportsFileStorage;
        for (const id of ["btn-save-game", "btn-export-game", "btn-load-game", "btn-import-game"]) {
            el[id].disabled = Boolean(blocked || !state || (["btn-save-game", "btn-export-game"].includes(id) && !this.started));
        }
        for (const id of ["btn-load-game", "btn-import-game"]) {
            el[id].disabled = Boolean(!state || this.busy || this.board.inputManager.busy
                || (this.sync.isBusy() && !this.sync.isBotOperation()));
        }
        for (const id of ["btn-end", "btn-draw", "btn-claim-fifty"]) {
            el[id].hidden = !active;
            el[id].disabled = blocked || Boolean(pending) || Boolean(botTurn);
        }
        if (active && this.config.mode === "human_vs_bot") {
            el["btn-end"].disabled = Boolean(this.busy || this.board.inputManager.busy
                || (this.sync.isBusy() && !this.sync.isBotOperation()));
        }
        el["btn-draw"].disabled ||= !state?.canOfferDraw;
        el["btn-draw"].title = state?.canOfferDraw ? "" : "Mỗi bên cần đi ít nhất một nước trước khi đề nghị hòa.";
        el["btn-claim-fifty"].hidden = !active || !state?.canClaimFiftyMoveDraw;
        el["draw-response"].hidden = !pending || Boolean(botTurn);
        const responder = pending ? SIDE_NAME[otherSide(pending)] : "";
        el["btn-accept-draw"].textContent = `${responder}: đồng ý hòa`;
        el["btn-decline-draw"].textContent = `${responder}: tiếp tục chơi`;
        el["btn-accept-draw"].disabled = blocked || !pending;
        el["btn-decline-draw"].disabled = blocked || !pending;
        if (active && !pending && !botTurn && !this.currentBotTask() && !this.busy && !this.sync.isBusy()) {
            this.board.inputManager.enable();
        } else {
            this.board.inputManager.disable();
        }
        if (botTurn && !blocked) this.queueBot(state);
        if (!this.busy && !this.sync.isBusy() && !this.board.inputManager.busy) this.idleWaiters.splice(0).forEach(resolve => resolve());
    }

    async run(action, { replace = false } = {}) {
        if (this.busy || (this.sync.isBusy() && !(replace && this.sync.isBotOperation()))
            || (!replace && this.currentBotTask()) || this.board.inputManager.busy) return;
        this.busy = true;
        this.elements["action-message"].textContent = "";
        this.render();
        try { await action(); }
        catch (error) { await this.recover(error, { keepBusy: true }); }
        finally { this.busy = false; this.render(); }
    }

    async restore() {
        return this.run(() => this.sync.refresh());
    }

    async save() {
        return this.run(async () => {
            await this.sync.api.saveGame(1, this.sync.context());
            this.elements["action-message"].textContent = "Đã lưu ván trong trình duyệt. Lưu lần sau sẽ thay bản này.";
        });
    }

    async exportFile() {
        return this.run(async () => {
            downloadGameFile(await this.sync.api.exportGame(this.sync.context()), this.document);
            this.elements["action-message"].textContent = "Đã xuất ván thành tệp JSON.";
        });
    }

    async confirmLoad(file, title) {
        const preview = await this.sync.api.inspectGame(file);
        const controls = preview.matchConfig?.mode === "human_vs_bot"
            ? `Chơi với bot. Bạn cầm ${SIDE_NAME[preview.matchConfig.humanColor]}, bot cầm ${SIDE_NAME[otherSide(preview.matchConfig.humanColor)]}.`
            : "Hai người luân phiên trên cùng thiết bị.";
        const choice = await this.dialog.open({
            title,
            description: `${controls} ${preview.movesPlayed} nửa lượt. ${describeState(preview)} Ván trên bàn sẽ được thay bằng bản này.`,
            choices: [{ value: "load", label: "Thay bằng ván này" }],
            cancelLabel: "Giữ ván hiện tại",
        });
        if (choice !== "load") return;
        await this.sync.importGame(file);
        this.elements["action-message"].textContent = "Đã tải ván. Có thể tiếp tục chơi hoặc Chơi lại nếu ván đã kết thúc.";
    }

    async load() {
        return this.run(async () => {
            const { file } = await this.sync.api.readSavedGame(1);
            await this.confirmLoad(file, "Tải ván đã lưu trong trình duyệt?");
        }, { replace: true });
    }

    async importFile(file) {
        // Returning from a system file picker can trigger a visibility refresh first.
        // Keep the selected File until that action completes instead of dropping it.
        while (!this.destroyed && (this.busy || (this.sync.isBusy() && !this.sync.isBotOperation()) || this.board.inputManager.busy)) {
            await new Promise(resolve => this.idleWaiters.push(resolve));
        }
        if (this.destroyed) return;
        return this.run(async () => {
            const text = await readGameFile(file);
            await this.confirmLoad(text, `Nhập ván từ ${file.name}?`);
        }, { replace: true });
    }

    async start() {
        if (this.started && !isGameOver(this.sync.exportState())) return;
        return this.run(async () => {
            if (!this.sync.exportState()) await this.sync.refresh();
            this.config = this.readConfig();
            this.botFailedKey = null;
            await this.sync.newGame(this.config);
            this.started = true;
        });
    }

    async resign() {
        const state = this.sync.exportState();
        const botGame = this.config.mode === "human_vs_bot";
        if (!this.started || !state || isGameOver(state) || (!botGame && state.drawOfferPending)) return;
        const color = botGame ? this.config.humanColor : state.turn;
        const generation = this.sync.generation;
        return this.run(async () => {
            const choice = await this.dialog.open({
                title: `${SIDE_NAME[color]} xác nhận đầu hàng?`,
                description: `${SIDE_NAME[otherSide(color)]} sẽ thắng và ván cờ kết thúc.`,
                choices: [{ value: "resign", label: "Xác nhận đầu hàng" }],
                cancelLabel: "Tiếp tục ván cờ",
            });
            if (choice === "resign" && generation === this.sync.generation) await this.sync.resign();
        }, { replace: botGame });
    }

    async draw(action) {
        const state = this.sync.exportState();
        if (!this.started || !state || isGameOver(state)) return;
        if (action === "offer" && !state.canOfferDraw) return;
        if (action === "claim" && !state.canClaimFiftyMoveDraw) return;
        if (["accept", "decline"].includes(action) && !state.drawOfferPending) return;
        return this.run(() => {
            if (action === "offer") return this.sync.offerDraw();
            if (action === "claim") return this.sync.claimFiftyMoveDraw();
            const responder = otherSide(state.drawOfferPending);
            return action === "accept" ? this.sync.acceptDraw(responder) : this.sync.declineDraw(responder);
        });
    }

    async recover(error, { keepBusy = false } = {}) {
        this.busy = true;
        this.elements["action-message"].textContent = "Không thực hiện được thao tác. Đang đồng bộ lại ván cờ…";
        this.render();
        try { if (!this.sync.isBusy()) await this.sync.refresh(); }
        catch { /* Retain the last confirmed board if the connection is unavailable. */ }
        finally {
            if (["invalid_save", "save_missing"].includes(error.code)) {
                this.elements["action-message"].textContent = error.message;
            } else if (isGameOver(this.sync.exportState())) {
                this.elements["action-message"].textContent = "";
            } else {
                this.elements["action-message"].textContent = error.code?.startsWith("worker_") || ["storage_error", "invalid_save", "save_missing", "bot_error", "no_bot_move"].includes(error.code)
                    ? error.message
                    : error.code === "stale_state"
                    ? "Thế cờ đã thay đổi. Hãy chọn quân và thử lại."
                    : [400, 409, 422].includes(error.status)
                        ? "Thao tác chưa hợp lệ trong thế cờ này. Hãy thử lại."
                        : "Không thể hoàn tất thao tác. Kiểm tra kết nối máy chủ rồi thử lại.";
            }
            this.busy = keepBusy;
            this.render();
        }
    }

    destroy() {
        this.destroyed = true;
        this.idleWaiters.splice(0).forEach(resolve => resolve());
        this.dialog.cancel();
        this.board.inputManager.disable();
        for (const cleanup of this.cleanups) cleanup?.();
        this.cleanups = [];
        this.sync.invalidate();
    }
}
