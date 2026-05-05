import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as logger from './logger.js';
/**
 * Single-worker pool for SQLite writes. Mirrors the structure of
 * `db-reader-pool.ts` so the rest of the main process talks to both
 * via the same `call<T>(method, args)` shape.
 *
 * The pool is intentionally a "pool of one": SQLite's writer model
 * is single-writer-at-a-time. A second writer worker would just
 * serialise behind the first via `busy_timeout`, gaining no
 * parallelism. The wrapper exists to:
 *   1. Move the synchronous `.run()` calls off the Electron main
 *      thread so IPC + queue scheduling stay live during writes.
 *   2. Give us one centralised place to add batching / rate-limiting
 *      later (Phase 2 — micro-batching).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, 'db-writer-worker.js');
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000;
class DbWriterPool {
    worker = null;
    dbPath = null;
    freezeWatchdogSab = null;
    nextRequestId = 1;
    pending = new Map();
    restartTimes = [];
    terminated = false;
    init(dbPath, freezeWatchdogSab = null) {
        if (this.terminated) {
            throw new Error('DbWriterPool: cannot init after terminate()');
        }
        this.freezeWatchdogSab = freezeWatchdogSab;
        if (this.dbPath === dbPath && this.worker !== null)
            return;
        this.dbPath = dbPath;
        this.spawn();
    }
    swap(newPath, freezeWatchdogSab = null) {
        if (freezeWatchdogSab !== null)
            this.freezeWatchdogSab = freezeWatchdogSab;
        if (this.dbPath === newPath && this.worker !== null)
            return;
        this.failPendingWith('writer-swapped');
        this.dbPath = newPath;
        this.spawn();
    }
    isReady() {
        return this.worker !== null && !this.terminated;
    }
    call(method, args = []) {
        if (this.terminated)
            return Promise.reject(new Error('writer-terminated'));
        if (!this.worker)
            return Promise.reject(new Error('writer-not-initialised'));
        const requestId = this.nextRequestId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error(`writer-timeout: ${method} > ${REQUEST_TIMEOUT_MS}ms`));
            }, REQUEST_TIMEOUT_MS);
            this.pending.set(requestId, {
                resolve: resolve,
                reject,
                timer,
            });
            this.worker.postMessage({ requestId, method, args });
        });
    }
    async terminate() {
        this.terminated = true;
        this.failPendingWith('writer-terminated');
        if (this.worker) {
            const w = this.worker;
            this.worker = null;
            try {
                await w.terminate();
            }
            catch {
                /* already gone */
            }
        }
    }
    spawn() {
        if (!this.dbPath)
            return;
        if (this.worker) {
            const old = this.worker;
            this.worker = null;
            void old.terminate().catch(() => undefined);
        }
        try {
            const w = new Worker(WORKER_PATH, {
                workerData: {
                    dbPath: this.dbPath,
                    freezeWatchdogSab: this.freezeWatchdogSab,
                },
            });
            w.on('message', (msg) => this.handleResponse(msg));
            w.on('error', (err) => {
                logger.log('error', 'main', `db-writer worker error: ${err.message}`);
            });
            w.on('exit', (code) => this.handleExit(code));
            this.worker = w;
            logger.log('info', 'main', `db-writer worker spawned for ${this.dbPath}`);
        }
        catch (err) {
            logger.log('error', 'main', `db-writer worker spawn failed: ${err instanceof Error ? err.message : String(err)}`);
            this.worker = null;
        }
    }
    handleResponse(msg) {
        const pending = this.pending.get(msg.requestId);
        if (!pending)
            return;
        this.pending.delete(msg.requestId);
        clearTimeout(pending.timer);
        if (msg.ok) {
            pending.resolve(msg.result);
        }
        else {
            pending.reject(new Error(msg.error ?? 'writer-unknown-error'));
        }
    }
    handleExit(code) {
        this.worker = null;
        if (this.terminated)
            return;
        if (code === 0)
            return;
        this.failPendingWith('writer-crashed');
        const now = Date.now();
        this.restartTimes = this.restartTimes.filter((t) => now - t < RESTART_WINDOW_MS);
        if (this.restartTimes.length >= MAX_RESTARTS) {
            logger.log('error', 'main', `db-writer worker crashed ${MAX_RESTARTS}× within ${RESTART_WINDOW_MS}ms — giving up. Writes fall back to main-thread DB.`);
            return;
        }
        this.restartTimes.push(now);
        logger.log('warn', 'main', `db-writer worker exited with code ${code}; respawning (${this.restartTimes.length}/${MAX_RESTARTS})`);
        this.spawn();
    }
    failPendingWith(reason) {
        for (const p of this.pending.values()) {
            clearTimeout(p.timer);
            p.reject(new Error(reason));
        }
        this.pending.clear();
    }
}
export const dbWriterPool = new DbWriterPool();
/**
 * Helper: try the worker first, fall back to a synchronous main-thread
 * call on any worker error. The fallback keeps writes happening even
 * when the worker is crashed/restarting, at the cost of running on
 * main for that one operation.
 */
export async function callWriterOrFallback(method, args, fallback) {
    if (!dbWriterPool.isReady()) {
        return fallback();
    }
    try {
        return await dbWriterPool.call(method, args);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.log('warn', 'main', `'${method}' fell back to main-thread writer: ${msg}`);
        return fallback();
    }
}
//# sourceMappingURL=db-writer-pool.js.map