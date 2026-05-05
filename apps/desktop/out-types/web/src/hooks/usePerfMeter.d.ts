/**
 * Live performance sample exposed to the status bar.
 *
 *  - `fps` is the count of `requestAnimationFrame` callbacks that fired in
 *    the most recent 1-second sliding window. A healthy FreeCrawl idle
 *    sits at ~60 fps; sustained < 30 fps means the renderer's main
 *    thread is starved (heavy SQL pump on the main process competing for
 *    IPC, React reconciliation churn, or window-drag throttling).
 *
 *  - `heapMb` reads `performance.memory.usedJSHeapSize` (Chromium-only —
 *    Electron renderer always exposes it, so we don't gate it). When it
 *    grows monotonically across crawls without GC dips it points at a
 *    listener leak somewhere in the renderer tree.
 *
 * The sampler runs ~10 Hz (every ~100 ms). It updates state via
 * `setState` only when the integer fps OR the integer heapMb changes,
 * so React re-renders the status bar at most ~10 times/sec rather than
 * 60 — keeps the meter itself from contributing to the kasma it's
 * supposed to detect.
 */
export interface PerfSample {
    fps: number;
    heapMb: number | null;
    /**
     * Estimated main-thread busy time in ms. Measured by setting a
     * `setTimeout(…, 0)` and seeing how long it actually waited — when
     * the main thread is busy with synchronous work or IPC, the timeout
     * fires late by exactly that amount. Sub-10 ms means the renderer is
     * responsive to input; 50+ ms means clicks/drags will visibly lag.
     */
    inputLagMs: number;
}
export declare function usePerfMeter(): PerfSample;
//# sourceMappingURL=usePerfMeter.d.ts.map