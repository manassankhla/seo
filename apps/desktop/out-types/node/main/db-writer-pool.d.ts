declare class DbWriterPool {
    private worker;
    private dbPath;
    private freezeWatchdogSab;
    private nextRequestId;
    private pending;
    private restartTimes;
    private terminated;
    init(dbPath: string, freezeWatchdogSab?: SharedArrayBuffer | null): void;
    swap(newPath: string, freezeWatchdogSab?: SharedArrayBuffer | null): void;
    isReady(): boolean;
    call<T>(method: string, args?: unknown[]): Promise<T>;
    terminate(): Promise<void>;
    private spawn;
    private handleResponse;
    private handleExit;
    private failPendingWith;
}
export declare const dbWriterPool: DbWriterPool;
/**
 * Helper: try the worker first, fall back to a synchronous main-thread
 * call on any worker error. The fallback keeps writes happening even
 * when the worker is crashed/restarting, at the cost of running on
 * main for that one operation.
 */
export declare function callWriterOrFallback<T>(method: string, args: unknown[], fallback: () => T | Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=db-writer-pool.d.ts.map