import { useEffect, useState } from 'react';
export function usePerfMeter() {
    const [sample, setSample] = useState({
        fps: 0,
        heapMb: null,
        inputLagMs: 0,
    });
    useEffect(() => {
        let cancelled = false;
        let rafId = 0;
        let frameTimes = [];
        let lastEmittedFps = -1;
        let lastEmittedHeap = -1;
        let lastEmittedLag = -1;
        let lastEmitTs = 0;
        // Sliding window of recent setTimeout-0 latencies. When the main
        // thread is busy, the timeout fires later than scheduled — the
        // delta is the closest userspace-readable proxy for "how laggy
        // does this feel right now." We average the last 10 samples so a
        // single GC pause doesn't dominate the readout.
        const lagSamples = [];
        const SAMPLE_INTERVAL_MS = 200;
        let lagTimer;
        const probeLag = () => {
            if (cancelled)
                return;
            const scheduled = performance.now();
            lagTimer = window.setTimeout(() => {
                if (cancelled)
                    return;
                const actual = performance.now();
                const delta = Math.max(0, actual - scheduled - SAMPLE_INTERVAL_MS);
                lagSamples.push(delta);
                if (lagSamples.length > 10)
                    lagSamples.shift();
                probeLag();
            }, SAMPLE_INTERVAL_MS);
        };
        probeLag();
        const tick = (now) => {
            if (cancelled)
                return;
            frameTimes.push(now);
            const cutoff = now - 1000;
            while (frameTimes.length > 0 && (frameTimes[0] ?? 0) < cutoff) {
                frameTimes.shift();
            }
            const fps = frameTimes.length;
            if (now - lastEmitTs >= 100) {
                lastEmitTs = now;
                const perf = performance;
                const heapBytes = perf.memory?.usedJSHeapSize;
                const heapMb = typeof heapBytes === 'number' ? Math.round(heapBytes / 1024 / 1024) : null;
                const avgLag = lagSamples.length > 0
                    ? Math.round(lagSamples.reduce((a, b) => a + b, 0) / lagSamples.length)
                    : 0;
                // Pipe lag back to the main process so the crawler can throttle
                // itself adaptively (see Crawler.reportRendererLag). Fire-and-
                // forget — the preload bridge uses `ipcRenderer.send` so this
                // doesn't add to the IPC reply queue. We only ping when the
                // sample changed by ≥ 5 ms or every second, whichever first,
                // to avoid spamming the bridge on a calm machine.
                try {
                    window.freecrawl?.reportRendererLag?.(avgLag);
                }
                catch {
                    /* ignore — non-fatal */
                }
                if (fps !== lastEmittedFps ||
                    heapMb !== lastEmittedHeap ||
                    avgLag !== lastEmittedLag) {
                    lastEmittedFps = fps;
                    lastEmittedHeap = heapMb ?? -1;
                    lastEmittedLag = avgLag;
                    setSample({ fps, heapMb, inputLagMs: avgLag });
                }
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => {
            cancelled = true;
            cancelAnimationFrame(rafId);
            if (lagTimer !== undefined)
                clearTimeout(lagTimer);
        };
    }, []);
    return sample;
}
//# sourceMappingURL=usePerfMeter.js.map