declare class DbReaderPool {
    private worker;
    private dbPath;
    private freezeWatchdogSab;
    private nextRequestId;
    private pending;
    private restartTimes;
    private terminated;
    /** Spawn (or respawn) the worker pointed at `dbPath`. Idempotent.
     *
     *   `freezeWatchdogSab` — if provided, the worker will tick its
     *   own heartbeat + publish its current method into this shared
     *   buffer so the freeze-watchdog thread can detect a stuck
     *   reader. Pass `null` to disable diagnostics. */
    init(dbPath: string, freezeWatchdogSab?: SharedArrayBuffer | null): void;
    /** Switch the worker to a different .seoproject file. */
    swap(newPath: string, freezeWatchdogSab?: SharedArrayBuffer | null): void;
    /** Permanent shutdown — used on app quit. */
    terminate(): Promise<void>;
    /** True while a worker is up and ready to receive requests. */
    isReady(): boolean;
    /**
     * Dispatch a method call to the worker. Callers should use the typed
     * wrapper `callReader<T>(method, args)` declared in the main process
     * IPC layer. Resolves with the method's return value, rejects with
     * an Error on worker error / timeout / crash.
     */
    call<T>(method: string, args?: unknown[]): Promise<T>;
    private spawn;
    private handleResponse;
    private handleExit;
    private failPendingWith;
}
export declare const dbReaderPool: DbReaderPool;
/**
 * Thin helper for IPC handlers: try the worker first, fall back to the
 * synchronous main-process DB on any worker error. The fallback path
 * keeps the UI working even if the worker is crashed/restarting, at
 * the cost of running on the main thread for that one query.
 */
export declare function callReaderOrFallback<T>(method: string, args: unknown[], fallback: () => T | Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=db-reader-pool.d.ts.map