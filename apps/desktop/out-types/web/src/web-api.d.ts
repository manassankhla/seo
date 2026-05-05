export declare const webApi: {
    crawlStart: (config: any) => Promise<any>;
    crawlStop: () => Promise<any>;
    urlsQuery: (input: any) => Promise<any>;
    overviewGet: () => Promise<any>;
    prefsGetAll: () => {
        sidebarWidth: number;
        detailPanelHeight: number;
        theme: string;
    };
    appVersion: () => Promise<string>;
    onProgress: (cb: any) => () => import("socket.io-client").Socket<import("@socket.io/component-emitter").DefaultEventsMap, import("@socket.io/component-emitter").DefaultEventsMap>;
    onDone: (cb: any) => () => import("socket.io-client").Socket<import("@socket.io/component-emitter").DefaultEventsMap, import("@socket.io/component-emitter").DefaultEventsMap>;
    onLogEntry: (cb: any) => () => void;
    onLogsBatch: (cb: any) => () => import("socket.io-client").Socket<import("@socket.io/component-emitter").DefaultEventsMap, import("@socket.io/component-emitter").DefaultEventsMap>;
    onError: (cb: any) => () => import("socket.io-client").Socket<import("@socket.io/component-emitter").DefaultEventsMap, import("@socket.io/component-emitter").DefaultEventsMap>;
    onDataChanged: (cb: any) => () => import("socket.io-client").Socket<import("@socket.io/component-emitter").DefaultEventsMap, import("@socket.io/component-emitter").DefaultEventsMap>;
    reportRendererLag: () => void;
    logsOpenWindow: () => Promise<void>;
    prefsGet: () => null;
    prefsSet: () => void;
    onMenuEvent: () => () => void;
};
//# sourceMappingURL=web-api.d.ts.map