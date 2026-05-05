import { io } from 'socket.io-client';
const API_BASE = 'http://localhost:3000/api';
const socket = io('http://localhost:3000');
export const webApi = {
    crawlStart: async (config) => {
        const res = await fetch(`${API_BASE}/crawl/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return res.json();
    },
    crawlStop: async () => {
        const res = await fetch(`${API_BASE}/crawl/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return res.json();
    },
    urlsQuery: async (input) => {
        const res = await fetch(`${API_BASE}/urls/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });
        return res.json();
    },
    overviewGet: async () => {
        const res = await fetch(`${API_BASE}/overview/get`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        return res.json();
    },
    prefsGetAll: () => {
        return {
            sidebarWidth: 260,
            detailPanelHeight: 300,
            theme: 'dark'
        };
    },
    appVersion: async () => "1.0.0 (Web)",
    onProgress: (cb) => {
        socket.on('crawl:progress', cb);
        return () => socket.off('crawl:progress', cb);
    },
    onDone: (cb) => {
        socket.on('crawl:done', cb);
        return () => socket.off('crawl:done', cb);
    },
    onLogEntry: (cb) => {
        // legacy single log
        return () => { };
    },
    onLogsBatch: (cb) => {
        socket.on('logs:batch', cb);
        return () => socket.off('logs:batch', cb);
    },
    onError: (cb) => {
        socket.on('crawl:error', cb);
        return () => socket.off('crawl:error', cb);
    },
    onDataChanged: (cb) => {
        socket.on('data:changed', cb);
        return () => socket.off('data:changed', cb);
    },
    reportRendererLag: () => { },
    // mock for preferences and logs window
    logsOpenWindow: async () => { },
    prefsGet: () => null,
    prefsSet: () => { },
    onMenuEvent: () => () => { },
};
// In browser mode, we inject this into window so the rest of the app thinks it's running in Electron.
if (typeof window !== 'undefined' && !window.freecrawl) {
    window.freecrawl = webApi;
}
//# sourceMappingURL=web-api.js.map