/**
 * Shared SharedArrayBuffer layout for the freeze watchdog.
 *
 * Three execution contexts read/write to the same SAB:
 *   1. The Electron main process (the writer for `mainHB`, counters,
 *      `mainOp`, and rendererLag forwarded from IPC).
 *   2. The db-reader worker thread (writes its own `readerHB` and
 *      `readerOp`).
 *   3. The freeze-watchdog worker thread (reads everything; writes
 *      nothing — its job is purely observational).
 *
 * All scalar reads/writes use `Atomics.{load,store}` so the watchdog
 * is guaranteed to see the latest value even if the writer is mid-
 * function. The op-string regions are written non-atomically (a 256-
 * byte memcpy isn't atomic on any CPU) — we accept torn reads there
 * because the op string is best-effort context, not a correctness
 * boundary; the heartbeat timestamp is what tells us whether a
 * thread is alive, and that IS atomic.
 *
 * Layout (1024 bytes total, generous for future fields):
 *   [0..32)    BigInt64Array(4)  — heartbeat timestamps + spare
 *      [0]    main heartbeat (ms since epoch)
 *      [1]    db-reader heartbeat
 *      [2]    last renderer lag-report timestamp
 *      [3]    spare
 *   [32..96)   Int32Array(16)    — counters + op-string lengths
 *      [0]    renderer lag (ms)
 *      [1]    crawled
 *      [2]    discovered
 *      [3]    pending
 *      [4]    failed
 *      [5]    main op string byte length
 *      [6]    reader op string byte length
 *      [7..15] spare
 *   [96..)     Uint8Array        — op string bytes (UTF-8)
 *      [0..256)    main op
 *      [256..512)  reader op
 */
export declare const SAB_BYTE_LENGTH = 1024;
export interface CounterPatch {
    crawled?: number;
    discovered?: number;
    pending?: number;
    failed?: number;
}
export interface CounterSnapshot {
    crawled: number;
    discovered: number;
    pending: number;
    failed: number;
}
/**
 * Wraps a `SharedArrayBuffer` with typed accessors. Construct one in
 * the main process via `FreezeWatchdogSharedState.create()`, then pass
 * `state.sab` to each worker via `workerData` so all sides share the
 * same memory.
 */
export declare class FreezeWatchdogSharedState {
    readonly sab: SharedArrayBuffer;
    private readonly i64;
    private readonly i32;
    private readonly u8;
    static create(): FreezeWatchdogSharedState;
    constructor(sab: SharedArrayBuffer);
    tickMainHeartbeat(): void;
    tickReaderHeartbeat(): void;
    reportRendererLag(lagMs: number): void;
    setMainOp(op: string): void;
    setReaderOp(op: string): void;
    updateCounters(c: CounterPatch): void;
    readMainHeartbeatMs(): number;
    readReaderHeartbeatMs(): number;
    readRendererReportTsMs(): number;
    readRendererLagMs(): number;
    readCounters(): CounterSnapshot;
    readMainOp(): string;
    readReaderOp(): string;
    private writeOpString;
    private readOpString;
}
//# sourceMappingURL=freeze-watchdog-shared.d.ts.map