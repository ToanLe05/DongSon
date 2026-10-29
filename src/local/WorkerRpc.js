export default class WorkerRpc {
    constructor(createWorker, config, { timeout = 120000, onProgress = () => {} } = {}) {
        this.createWorker = createWorker;
        this.config = config;
        this.timeout = timeout;
        this.onProgress = onProgress;
        this.pending = new Map();
        this.nextId = 1;
    }
    connect() {
        if (this.closed) return Promise.reject(this.error("worker_closed", "Bộ luật đã đóng."));
        if (this.ready) return this.ready;
        try {
            const worker = this.createWorker();
            this.worker = worker;
            const active = () => !this.closed && this.worker === worker;
            worker.onmessage = ({ data }) => {
                if (!active()) return;
                if (data.type === "progress") { this.onProgress(data.message); return; }
                const pending = this.pending.get(data.id);
                if (!pending) return;
                this.pending.delete(data.id);
                clearTimeout(pending.timer);
                if (data.ok) pending.resolve(data.result);
                else {
                    const error = Object.assign(new Error(data.error.message), data.error);
                    // A Python/runtime failure needs a fresh interpreter, just like a crashed worker.
                    // Rule conflicts and storage errors retain their recoverable session instead.
                    if (error.code === "worker_unavailable") this.fail(error);
                    pending.reject(error);
                }
            };
            worker.onerror = event => {
                event.preventDefault?.();
                if (!active()) return;
                this.fail(this.error("worker_unavailable", "Bộ luật bị ngắt. Hãy thử lại để khôi phục ván đã lưu."));
            };
            worker.onmessageerror = () => { if (active()) this.fail(this.error("worker_unavailable", "Không đọc được phản hồi bộ luật.")); };
            const ready = this.send({ type: "init", config: this.config }).catch(error => {
                if (this.worker === worker) this.fail(error);
                else if (this.ready === ready) this.ready = null;
                throw error;
            });
            this.ready = ready;
        } catch (error) {
            this.fail(error);
            return Promise.reject(error);
        }
        return this.ready;
    }
    async request(endpoint, body) {
        const info = await this.connect();
        this.notice = info.notice;
        return this.send({ type: "command", endpoint, body });
    }
    send(message) {
        if (this.closed || !this.worker) return Promise.reject(this.error("worker_closed", "Bộ luật đã đóng."));
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => this.fail(this.error("worker_timeout", "Bộ luật mất quá nhiều thời gian. Hãy thử lại để khôi phục ván đã lưu.")), this.timeout);
            this.pending.set(id, { resolve, reject, timer });
            try { this.worker.postMessage({ ...message, id }); }
            catch (error) { this.fail(error); }
        });
    }
    error(code, message) { return Object.assign(new Error(message), { code, status: 503 }); }
    fail(error) {
        this.worker?.terminate();
        this.worker = null;
        this.ready = null;
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
    }
    destroy() {
        this.closed = true;
        this.fail(this.error("worker_closed", "Bộ luật đã đóng."));
    }
}
