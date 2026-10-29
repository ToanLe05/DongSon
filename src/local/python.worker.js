import engineSource from "../dongson_engine.py?raw";
import serializerSource from "../serializers.py?raw";
import bridgeSource from "../browser_bridge.py?raw";
import { openStore, readSnapshot, commitSnapshot, writeSavedGame, savedSlotKey } from "./storage.js";

const MUTATIONS = new Set(["/new_game", "/move", "/resign", "/draw", "/import"]);
let api, db, key, persisted = null;
let queue = Promise.resolve();

const failure = (status, code, message, state) => ({ ok: false, error: { status, code, message, state } });
function state() { return JSON.parse(api.dispatch(JSON.stringify({ endpoint: "/state" }))).result; }

async function initialize(config, id) {
    if (api) return { ok: true, result: { ready: true } };
    self.postMessage({ type: "progress", id, message: "Đang tải bộ luật Python… Lần mở đầu có thể cần chờ một chút." });
    const { loadPyodide } = await import(/* @vite-ignore */ new URL("pyodide.mjs", config.runtimeURL).href);
    const python = await loadPyodide({ indexURL: config.runtimeURL });
    self.postMessage({ type: "progress", id, message: "Đang chuẩn bị bàn cờ và khôi phục ván…" });
    python.FS.mkdirTree("/home/pyodide/dongson");
    for (const [name, source] of Object.entries({ dongson_engine: engineSource, serializers: serializerSource, browser_bridge: bridgeSource })) {
        python.FS.writeFile(`/home/pyodide/dongson/${name}.py`, source, { encoding: "utf8" });
    }
    python.runPython('import sys; sys.path.insert(0, "/home/pyodide/dongson")');
    const module = python.pyimport("browser_bridge");
    api = { dispatch: module.dispatch_json.copy(), checkpoint: module.checkpoint_json.copy(), restore: module.restore_json.copy() };
    module.destroy();
    key = config.key;
    db = await openStore();
    persisted = await readSnapshot(db, key);
    let notice = "";
    try { api.restore(persisted); }
    catch {
        // Preserve the corrupt record until an explicit new game replaces it atomically.
        api.restore(null);
        notice = "Bản lưu không đọc được. Chọn Bắt đầu để tạo ván mới.";
    }
    return { ok: true, result: { ready: true, notice } };
}

async function command(message) {
    if (!api || !db) return failure(503, "worker_unavailable", "Bộ luật chưa sẵn sàng. Hãy thử lại.");
    const latest = await readSnapshot(db, key);
    if (latest !== persisted) {
        api.restore(latest);
        persisted = latest;
    }
    if (["/save", "/read_save", "/load"].includes(message.endpoint)) {
        const slot = message.body?.slot ?? 1;
        if (!Number.isInteger(slot) || slot < 1 || slot > 9) return failure(422, "invalid_save", "Ô lưu không hợp lệ.");
        if (message.endpoint === "/save") {
            const exported = JSON.parse(api.dispatch(JSON.stringify({ endpoint: "/export", body: message.body })));
            if (!exported.ok) return exported;
            try { await writeSavedGame(db, slot, exported.result.file); }
            catch { return failure(503, "storage_error", "Không lưu được ván cờ trong trình duyệt. Hãy thử xuất tệp JSON."); }
            return { ok: true, result: { saved: true, slot } };
        }
        const file = await readSnapshot(db, savedSlotKey(slot));
        if (file === null) return failure(404, "save_missing", "Chưa có ván được lưu. Hãy dùng Lưu ván hoặc Nhập JSON.");
        if (message.endpoint === "/read_save") return { ok: true, result: { file } };
        message = { ...message, endpoint: "/import", body: { ...message.body, file } };
    }
    const before = MUTATIONS.has(message.endpoint) ? api.checkpoint() : null;
    let response;
    try { response = JSON.parse(api.dispatch(JSON.stringify({ endpoint: message.endpoint, body: message.body }))); }
    catch (error) { if (before) api.restore(before); throw error; }
    if (!response.ok || !MUTATIONS.has(message.endpoint)) return response;
    try {
        const snapshot = api.checkpoint();
        const result = await commitSnapshot(db, key, persisted, snapshot);
        if (!result.committed) {
            api.restore(result.snapshot);
            persisted = result.snapshot;
            return failure(409, "stale_state", "Thế cờ đã thay đổi. Vui lòng thử lại.", state());
        }
        persisted = snapshot;
        return response;
    } catch {
        api.restore(before);
        return failure(503, "storage_error", "Không lưu được ván cờ. Kiểm tra dung lượng trình duyệt rồi thử lại.", state());
    }
}

self.onmessage = ({ data }) => {
    // Initialization and every operation share one queue, including asynchronous storage.
    queue = queue.then(async () => {
        try {
            const response = data.type === "init" ? await initialize(data.config, data.id) : await command(data);
            self.postMessage({ type: "result", id: data.id, ...response });
        } catch (error) {
            console.error("Local Python engine:", error);
            const message = data.type === "init"
                ? "Không khởi động được bộ luật. Bấm Bắt đầu để thử lại."
                : "Bộ luật bị ngắt. Hãy thử lại để khôi phục ván đã lưu.";
            self.postMessage({ type: "result", id: data.id, ...failure(503, "worker_unavailable", message) });
        }
    });
};
