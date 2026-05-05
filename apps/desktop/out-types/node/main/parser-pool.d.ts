import type { parseHtml } from '@freecrawl/core';
type ParseHtmlArgs = Parameters<typeof parseHtml>;
type ParseOpts = ParseHtmlArgs[2];
type ParseResult = ReturnType<typeof parseHtml>;
declare class ParserPool {
    private workers;
    private pending;
    private nextRequestId;
    private nextWorkerIdx;
    private terminated;
    /**
     * Spawn the worker pool. Idempotent — calling init() twice is a
     * no-op once workers are already running.
     *
     *   `size` — number of worker threads. Defaults to a sensible
     *   value based on CPU count (cores - 2, clamped to [2, 8]).
     *   Leave room for the main thread + db-reader + db-writer +
     *   freeze-watchdog so the crawler isn't competing with its own
     *   plumbing for cores.
     */
    init(size?: number): void;
    /** True when at least one worker is running and accepting requests. */
    isReady(): boolean;
    /**
     * Dispatch a parse request to the next available worker.
     * Resolves with the parsed page; rejects on timeout or worker
     * crash. Caller is expected to fall back to inline `parseHtml`
     * if the pool isn't ready.
     */
    parse(html: string, pageUrl: string, opts?: ParseOpts): Promise<ParseResult>;
    terminate(): Promise<void>;
    private spawnWorker;
    private tryRespawn;
    private handleResponse;
}
export declare const parserPool: ParserPool;
export {};
//# sourceMappingURL=parser-pool.d.ts.map