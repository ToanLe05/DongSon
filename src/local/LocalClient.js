import ApiClient from "../network/ApiClient.js";
import WorkerRpc from "./WorkerRpc.js";
import { pythonRuntimeUrl } from "./runtimeUrl.js";

export default class LocalClient extends ApiClient {
    constructor({ onProgress } = {}) {
        super();
        let key;
        try {
            key = sessionStorage.getItem("dongson.tab.v1");
            if (!key) { key = crypto.randomUUID(); sessionStorage.setItem("dongson.tab.v1", key); }
        } catch { key = crypto.randomUUID(); }
        this.rpc = new WorkerRpc(
            () => new Worker(new URL("./python.worker.js", import.meta.url), { type: "module", name: "dongson-python" }),
            { key, runtimeURL: pythonRuntimeUrl(import.meta.env.BASE_URL, document.baseURI) }, { onProgress },
        );
    }
    request(endpoint, _method = "GET", body = null) { return this.rpc.request(endpoint, body); }
    supportsFileStorage = true;
    saveGame(slot = 1, context = {}) { return this.rpc.request("/save", { ...context, slot }); }
    readSavedGame(slot = 1) { return this.rpc.request("/read_save", { slot }); }
    loadGame(slot = 1, context = {}) { return this.rpc.request("/load", { ...context, slot }); }
    exportGame(context = {}) { return this.rpc.request("/export", context); }
    inspectGame(file) { return this.rpc.request("/inspect_save", { file }); }
    importGame(file, context = {}) { return this.rpc.request("/import", { ...context, file }); }
    get notice() { return this.rpc.notice; }
    destroy() { this.rpc.destroy(); }
}
