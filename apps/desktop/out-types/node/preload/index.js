import { contextBridge, ipcRenderer } from 'electron';
import { IPC, } from '@freecrawl/shared-types';
function subscribe(channel, cb) {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
}
// Hydrate preferences synchronously so the renderer never sees a flash of
// default layout before prefs load. Written via async IPC afterwards.
const prefsCache = ipcRenderer.sendSync(IPC.prefsGetAllSync) ?? {};
const api = {
    crawlStart: (config) => ipcRenderer.invoke(IPC.crawlStart, config),
    crawlStop: () => ipcRenderer.invoke(IPC.crawlStop),
    crawlPause: () => ipcRenderer.invoke(IPC.crawlPause),
    crawlResume: () => ipcRenderer.invoke(IPC.crawlResume),
    crawlClear: () => ipcRenderer.invoke(IPC.crawlClear),
    crawlAddUrl: (url) => ipcRenderer.invoke(IPC.crawlAddUrl, url),
    projectSaveAs: () => ipcRenderer.invoke(IPC.projectSaveAs),
    projectOpen: (filePath) => ipcRenderer.invoke(IPC.projectOpen, filePath),
    projectCurrentPath: () => ipcRenderer.invoke(IPC.projectCurrentPath),
    urlsQuery: (input) => ipcRenderer.invoke(IPC.urlsQuery, input),
    urlDetailGet: (input) => ipcRenderer.invoke(IPC.urlDetailGet, input),
    urlSourceGet: (input) => ipcRenderer.invoke(IPC.urlSourceGet, input),
    urlPageImages: (input) => ipcRenderer.invoke(IPC.urlPageImages, input),
    urlCertInfo: (input) => ipcRenderer.invoke(IPC.urlCertInfo, input),
    urlContextMenu: (input) => ipcRenderer.invoke(IPC.urlContextMenu, input),
    urlBulkContextMenu: (input) => ipcRenderer.invoke(IPC.urlBulkContextMenu, input),
    imagesQuery: (input) => ipcRenderer.invoke(IPC.imagesQuery, input),
    brokenLinksQuery: (input) => ipcRenderer.invoke(IPC.brokenLinksQuery, input),
    overviewGet: () => ipcRenderer.invoke(IPC.overviewGet),
    summaryGet: () => ipcRenderer.invoke(IPC.summaryGet),
    exportCsv: (input) => ipcRenderer.invoke(IPC.exportCsv, input),
    exportJson: (input) => ipcRenderer.invoke(IPC.exportJson, input),
    exportXml: (input) => ipcRenderer.invoke(IPC.exportXml, input),
    dataDeleteByDomain: (input) => ipcRenderer.invoke(IPC.dataDeleteByDomain, input),
    crashRecoveryStatus: () => ipcRenderer.invoke(IPC.crashRecoveryStatus),
    crashRecoveryResume: () => ipcRenderer.invoke(IPC.crashRecoveryResume),
    crashRecoveryDiscard: () => ipcRenderer.invoke(IPC.crashRecoveryDiscard),
    exportHtmlReport: (input) => ipcRenderer.invoke(IPC.exportHtmlReport, input),
    exportBulk: () => ipcRenderer.invoke(IPC.exportBulk),
    compareLoad: (input) => ipcRenderer.invoke(IPC.compareLoad, input),
    graphSnapshot: (input) => ipcRenderer.invoke(IPC.graphSnapshot, input),
    topAnchorTexts: (limit) => ipcRenderer.invoke(IPC.topAnchorTexts, limit),
    sitemapGenerate: (input) => ipcRenderer.invoke(IPC.sitemapGenerate, input),
    appVersion: () => ipcRenderer.invoke(IPC.appVersion),
    prefsGetAll: () => ({ ...prefsCache }),
    prefsGet: (key) => prefsCache[key],
    prefsSet: (key, value) => {
        prefsCache[key] = value;
        void ipcRenderer.invoke(IPC.prefsSet, key, value);
    },
    prefsDelete: (key) => {
        delete prefsCache[key];
        void ipcRenderer.invoke(IPC.prefsDelete, key);
    },
    confirmClear: () => ipcRenderer.invoke(IPC.confirmClear),
    logsGetAll: () => ipcRenderer.invoke(IPC.logsGetAll),
    logsClear: () => ipcRenderer.invoke(IPC.logsClear),
    logsOpenWindow: () => ipcRenderer.invoke(IPC.logsOpenWindow),
    robotsTest: (input) => ipcRenderer.invoke(IPC.robotsTest, input),
    sitemapValidate: (input) => ipcRenderer.invoke(IPC.sitemapValidate, input),
    reportsPagesPerDirectory: (input) => ipcRenderer.invoke(IPC.reportsPagesPerDirectory, input),
    reportsStatusCodeHistogram: () => ipcRenderer.invoke(IPC.reportsStatusCodeHistogram),
    reportsDepthHistogram: () => ipcRenderer.invoke(IPC.reportsDepthHistogram),
    reportsResponseTimeHistogram: () => ipcRenderer.invoke(IPC.reportsResponseTimeHistogram),
    reportsTopUrls: (input) => ipcRenderer.invoke(IPC.reportsTopUrls, input),
    reportsExternalDomainHealth: (limit) => ipcRenderer.invoke(IPC.reportsExternalDomainHealth, limit),
    reportsAnalyticsCoverage: () => ipcRenderer.invoke(IPC.reportsAnalyticsCoverage),
    reportsLinkPositions: () => ipcRenderer.invoke(IPC.reportsLinkPositions),
    reportsImageWeightPerPage: (limit) => ipcRenderer.invoke(IPC.reportsImageWeightPerPage, limit),
    reportsInlinksHistogram: () => ipcRenderer.invoke(IPC.reportsInlinksHistogram),
    reportsWordCountHistogram: () => ipcRenderer.invoke(IPC.reportsWordCountHistogram),
    reportsUrlLengthHistogram: () => ipcRenderer.invoke(IPC.reportsUrlLengthHistogram),
    reportsWordCountPerDirectory: (input) => ipcRenderer.invoke(IPC.reportsWordCountPerDirectory, input),
    reportsSitemapOrphans: (limit) => ipcRenderer.invoke(IPC.reportsSitemapOrphans, limit),
    // Fire-and-forget — `send` not `invoke` because we don't need a
    // response and we want this to be cheap (≤ 1 ms per call, no wait).
    reportRendererLag: (lagMs) => {
        ipcRenderer.send(IPC.rendererLagReport, lagMs);
    },
    reportsServerHeaders: () => ipcRenderer.invoke(IPC.reportsServerHeaders),
    prefsExportSettings: (input) => ipcRenderer.invoke(IPC.prefsExportSettings, input),
    prefsImportSettings: () => ipcRenderer.invoke(IPC.prefsImportSettings),
    onLogEntry: (cb) => subscribe(IPC.logsEntry, cb),
    onLogsBatch: (cb) => subscribe(IPC.logsBatch, cb),
    onLogsBusy: (cb) => subscribe(IPC.logsBusy, cb),
    onProgress: (cb) => subscribe(IPC.crawlProgress, cb),
    onDone: (cb) => subscribe(IPC.crawlDone, cb),
    onError: (cb) => subscribe(IPC.crawlError, cb),
    onMenuEvent: (cb) => subscribe(IPC.menuEvent, cb),
    onDataChanged: (cb) => {
        const listener = () => cb();
        ipcRenderer.on(IPC.dataChanged, listener);
        return () => ipcRenderer.removeListener(IPC.dataChanged, listener);
    },
};
contextBridge.exposeInMainWorld('freecrawl', api);
//# sourceMappingURL=index.js.map