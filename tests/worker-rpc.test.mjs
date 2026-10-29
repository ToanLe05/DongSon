import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/local/WorkerRpc.js", import.meta.url), "utf8");
const { default: WorkerRpc } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
class FakeWorker {
    sent = [];
    terminated = false;
    postMessage(message) { this.sent.push(message); }
    terminate() { this.terminated = true; }
    reply(message, result = {}, ok = true) { this.onmessage({ data: { type: "result", id: message.id, ok, ...(ok ? { result } : { error: result }) } }); }
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test("Python runtime error replies terminate the interpreter and recover through a fresh worker", async () => {
    const workers = [];
    const rpc = new WorkerRpc(() => { const worker = new FakeWorker(); workers.push(worker); return worker; }, {});
    const failed = rpc.request("/legal_moves");
    workers[0].reply(workers[0].sent[0], { ready: true }); await tick();
    workers[0].reply(workers[0].sent[1], { code: "worker_unavailable", status: 503, message: "Python failed" }, false);
    await assert.rejects(failed, { code: "worker_unavailable" });
    assert.equal(workers[0].terminated, true);
    assert.equal(rpc.pending.size, 0);
    const retry = rpc.request("/state");
    workers[1].reply(workers[1].sent[0], { ready: true }); await tick();
    workers[1].reply(workers[1].sent[1], { restored: true });
    assert.deepEqual(await retry, { restored: true }); rpc.destroy();
});

test("one initialization, distinct RPC IDs and out-of-order replies", async () => {
    const worker = new FakeWorker();
    const rpc = new WorkerRpc(() => worker, {});
    const a = rpc.request("/state"), b = rpc.request("/legal_moves");
    assert.equal(worker.sent.length, 1);
    worker.reply(worker.sent[0], { ready: true }); await tick();
    assert.equal(worker.sent.length, 3);
    worker.reply(worker.sent[2], ["b3"]); worker.reply(worker.sent[1], { turn: "thuy" });
    assert.deepEqual(await b, ["b3"]); assert.deepEqual(await a, { turn: "thuy" });
    assert.equal(rpc.pending.size, 0); rpc.destroy();
});
test("rule conflicts preserve their state and do not terminate the worker", async () => {
    const worker = new FakeWorker(), rpc = new WorkerRpc(() => worker, {});
    const promise = rpc.request("/move");
    worker.reply(worker.sent[0]); await tick();
    worker.reply(worker.sent[1], { code: "stale_state", status: 409, message: "changed", state: { revision: 2 } }, false);
    await assert.rejects(promise, error => error.code === "stale_state" && error.state.revision === 2);
    assert.equal(worker.terminated, false); rpc.destroy();
});
test("worker errors reject all waiters, release resources and permit a fresh worker", async () => {
    const workers = [], rpc = new WorkerRpc(() => { const w = new FakeWorker(); workers.push(w); return w; }, {});
    const a = rpc.request("/state"), b = rpc.request("/state");
    const results = Promise.allSettled([a, b]);
    workers[0].onerror({ preventDefault() {} });
    assert((await results).every(r => r.status === "rejected"));
    assert.equal(workers[0].terminated, true);
    const c = rpc.request("/state"); workers[1].reply(workers[1].sent[0]); await tick();
    workers[1].reply(workers[1].sent[1], { restored: true }); assert.deepEqual(await c, { restored: true });
    rpc.destroy();
});
test("timeouts terminate the worker and a late reply cannot resolve another command", async () => {
    const worker = new FakeWorker(), rpc = new WorkerRpc(() => worker, {}, { timeout: 15 });
    const request = rpc.request("/state");
    await assert.rejects(request, error => error.code === "worker_timeout");
    assert.equal(worker.terminated, true); assert.equal(rpc.pending.size, 0);
    worker.reply(worker.sent[0], { ignored: true }); rpc.destroy();
});
test("destroy rejects pending commands and does not recreate a worker", async () => {
    const worker = new FakeWorker(), rpc = new WorkerRpc(() => worker, {});
    const request = rpc.request("/state"); const result = assert.rejects(request, { code: "worker_closed" });
    rpc.destroy(); await result; await assert.rejects(rpc.request("/state"), { code: "worker_closed" });
});

test("late events from a terminated worker cannot affect its replacement", async () => {
    const workers = [], progress = [];
    const rpc = new WorkerRpc(() => { const w = new FakeWorker(); workers.push(w); return w; }, {}, { onProgress: message => progress.push(message) });
    const first = rpc.request("/state"); const rejected = assert.rejects(first);
    workers[0].onerror({ preventDefault() {} }); await rejected;
    const next = rpc.request("/state");
    workers[0].onerror({ preventDefault() {} });
    workers[0].onmessage({ data: { type: "progress", message: "obsolete" } });
    workers[1].reply(workers[1].sent[0]); await tick();
    workers[1].reply(workers[1].sent[1], { restored: true });
    assert.deepEqual(await next, { restored: true });
    assert.equal(workers[1].terminated, false); assert.deepEqual(progress, []); rpc.destroy();
});

test("a synchronous postMessage failure releases initialization so retry can succeed", async () => {
    let calls = 0;
    const healthy = new FakeWorker();
    const rpc = new WorkerRpc(() => ++calls === 1 ? { postMessage() { throw new Error("send failed"); }, terminate() {} } : healthy, {});
    await assert.rejects(rpc.request("/state"), /send failed/);
    const retry = rpc.request("/state"); healthy.reply(healthy.sent[0]); await tick();
    healthy.reply(healthy.sent[1], { ready: true }); assert.deepEqual(await retry, { ready: true }); rpc.destroy();
});
