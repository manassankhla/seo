import { io } from 'socket.io-client';
import type { FreeCrawlApi } from '@freecrawl/shared-types';

const API_BASE = 'http://localhost:3000/api';
const socket = io('http://localhost:3000');

// Local stub for methods that don't need backend or we stub out
const localOverrides: Partial<FreeCrawlApi> = {
  appVersion: async () => "1.0.0 (Web)",
  prefsGetAll: () => ({ sidebarWidth: 260, detailPanelHeight: 300, theme: 'dark' }),
  prefsGet: () => null,
  prefsSet: () => {},
  prefsDelete: () => {},
  logsOpenWindow: async () => {},
  onMenuEvent: () => () => {},
  onLogEntry: () => () => {},
  onLogsBusy: () => () => {},
  reportRendererLag: () => {},
  projectCurrentPath: async () => null,
  crashRecoveryStatus: async () => ({ pendingCount: 0, seedUrl: '' }),
  
  // Custom WebSocket event listeners
  onProgress: (cb: any) => {
    socket.on('crawl:progress', cb);
    return () => socket.off('crawl:progress', cb);
  },
  onDone: (cb: any) => {
    socket.on('crawl:done', cb);
    return () => socket.off('crawl:done', cb);
  },
  onLogsBatch: (cb: any) => {
    socket.on('logs:batch', cb);
    return () => socket.off('logs:batch', cb);
  },
  onError: (cb: any) => {
    socket.on('crawl:error', cb);
    return () => socket.off('crawl:error', cb);
  },
  onDataChanged: (cb: any) => {
    socket.on('data:changed', cb);
    return () => socket.off('data:changed', cb);
  },
  
  // Specifically map crawl/start
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
    
    // Everything else becomes a dynamically dispatched RPC over HTTP POST
    return async (input?: any) => {
      const res = await fetch(`${API_BASE}/rpc/${prop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input ? JSON.stringify(input) : undefined
      });
      if (!res.ok) {
        throw new Error(`API Error: ${res.statusText}`);
      }
      return res.json();
    };
  }
}) as FreeCrawlApi;

if (typeof window !== 'undefined') {
  (window as any).freecrawl = webApi;
}
