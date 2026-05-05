import { type CounterPatch } from './freeze-watchdog-shared.js';
declare class FreezeWatchdog {
    private worker;
    private state;
    private heartbeatTimer;
    private terminated;
    /**
     * Spawn the watchdog worker, allocate the SharedArrayBuffer, and
     * start the main-thread heartbeat ticker. Idempotent.
     */
    init(debugFilePath: string): void;
    /** Pass-through to the shared buffer so workers can attach. */
    get sharedBuffer(): SharedArrayBuffer | null;
    setMainOp(op: string): void;
    reportRendererLag(lagMs: number): void;
    updateCounters(c: CounterPatch): void;
    /** Graceful shutdown — flushes the heartbeat timer and signals the
     * worker to exit cleanly so it can write a `[SHUTDOWN]` line. */
    terminate(): Promise<void>;
}
export declare const freezeWatchdog: FreezeWatchdog;
export {};
//# sourceMappingURL=freeze-watchdog.d.ts.map