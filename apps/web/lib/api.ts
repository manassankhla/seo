import type { FreeCrawlApi } from '@freecrawl/shared-types';

const API_BASE = '/api';

// Simple event emitter for polling
class PollingEventEmitter {
  private listeners: Record<string, Set<Function>> = {};
  private intervals: Record<string, NodeJS.Timeout> = {};

  on(event: string, cb: Function) {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event].add(cb);
    this.startPolling(event);
  }

  off(event: string, cb: Function) {
    this.listeners[event]?.delete(cb);
    if (this.listeners[event]?.size === 0) this.stopPolling(event);
  }

  private startPolling(event: string) {
    if (this.intervals[event]) return;
    this.intervals[event] = setInterval(async () => {
      // In a real app, you'd fetch the latest events from the DB
      // For this demo, we'll just poll the summary
      const res = await fetch(`${API_BASE}/rpc/getSummary`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        this.listeners[event]?.forEach(cb => cb(data));
      }
    }, 3000);
  }

  private stopPolling(event: string) {
    clearInterval(this.intervals[event]);
    delete this.intervals[event];
  }
}

const events = new PollingEventEmitter();

const localOverrides: Partial<FreeCrawlApi> = {
  appVersion: async () => "1.0.0 (Web)",
  onProgress: (cb: any) => {
    events.on('progress', cb);
    return () => events.off('progress', cb);
  },
  onDone: (cb: any) => {
    events.on('done', cb);
    return () => events.off('done', cb);
  },
  onDataChanged: (cb: any) => {
    events.on('data:changed', cb);
    return () => events.off('data:changed', cb);
  },
  crawlStart: async (config: any) => {
    await fetch(`${API_BASE}/crawl/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }
};

export const webApi = new Proxy({}, {
  get(target, prop: string) {
    if (prop in localOverrides) {
      return localOverrides[prop as keyof typeof localOverrides];
    }
    return async (input?: any) => {
      const res = await fetch(`${API_BASE}/rpc/${prop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input ? JSON.stringify(input) : undefined
      });
      if (!res.ok) return null;
      return res.json();
    };
  }
}) as FreeCrawlApi;
