import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
const REPORT_LABELS = {
    'pages-per-dir': 'Pages per Directory',
    'status-codes': 'Status Code Histogram',
    depth: 'Depth Histogram',
    'response-time': 'Response Time Histogram',
    'slowest-urls': 'Slowest URLs (Top 25)',
    'most-inlinks': 'Most-Linked URLs (Top 25)',
    'most-outlinks': 'Most-Outlinking URLs (Top 25)',
    'biggest-pages': 'Biggest Pages (Top 25)',
    'deepest-urls': 'Deepest URLs (Top 25)',
    'external-domain-health': 'External Domain Health',
    'analytics-coverage': 'Analytics Tracker Coverage',
    'link-positions': 'Internal Link Positions',
    'image-weight': 'Image Weight per Page (Top 25)',
    'inlinks-histogram': 'Inlinks Histogram',
    'word-count-histogram': 'Word Count Histogram',
    'url-length-histogram': 'URL Length Histogram',
    'word-count-per-dir': 'Word Count per Directory',
    'sitemap-orphans': 'Sitemap Orphans (Top 1000)',
    'server-headers': 'Server Stack (Server Header)',
};
const KEY_LABELS = {
    'pages-per-dir': 'Directory',
    'status-codes': 'Status',
    depth: 'Depth',
    'response-time': 'Bucket',
    'slowest-urls': 'URL',
    'most-inlinks': 'URL',
    'most-outlinks': 'URL',
    'biggest-pages': 'URL',
    'deepest-urls': 'URL',
    'external-domain-health': 'Domain',
    'analytics-coverage': 'Tracker',
    'link-positions': 'Position',
    'image-weight': 'URL',
    'inlinks-histogram': 'Bucket',
    'word-count-histogram': 'Bucket',
    'url-length-histogram': 'Bucket',
    'word-count-per-dir': 'Directory',
    'sitemap-orphans': 'URL',
    'server-headers': 'Server',
};
const TOP_URL_METRIC = {
    'pages-per-dir': null,
    'status-codes': null,
    depth: null,
    'response-time': null,
    'slowest-urls': 'response-time',
    'most-inlinks': 'inlinks',
    'most-outlinks': 'outlinks',
    'biggest-pages': 'page-size',
    'deepest-urls': 'depth',
    'external-domain-health': null,
    'analytics-coverage': null,
    'link-positions': null,
    'image-weight': null,
    'inlinks-histogram': null,
    'word-count-histogram': null,
    'url-length-histogram': null,
    'word-count-per-dir': null,
    'sitemap-orphans': null,
    'server-headers': null,
};
const VALUE_FORMAT = {
    'pages-per-dir': (v) => (v ?? 0).toLocaleString(),
    'status-codes': (v) => (v ?? 0).toLocaleString(),
    depth: (v) => (v ?? 0).toLocaleString(),
    'response-time': (v) => (v ?? 0).toLocaleString(),
    'slowest-urls': (v) => (v == null ? '—' : `${v.toLocaleString()} ms`),
    'most-inlinks': (v) => (v ?? 0).toLocaleString(),
    'most-outlinks': (v) => (v ?? 0).toLocaleString(),
    'biggest-pages': (v) => (v == null ? '—' : `${(v / 1024).toFixed(1)} KB`),
    'deepest-urls': (v) => (v ?? 0).toLocaleString(),
    'external-domain-health': (v) => (v ?? 0).toLocaleString(),
    'analytics-coverage': (v) => (v ?? 0).toLocaleString(),
    'link-positions': (v) => (v ?? 0).toLocaleString(),
    'image-weight': (v) => {
        if (v == null)
            return '—';
        if (v < 1024)
            return `${v} B`;
        if (v < 1024 * 1024)
            return `${(v / 1024).toFixed(1)} KB`;
        return `${(v / 1024 / 1024).toFixed(2)} MB`;
    },
    'inlinks-histogram': (v) => (v ?? 0).toLocaleString(),
    'word-count-histogram': (v) => (v ?? 0).toLocaleString(),
    'url-length-histogram': (v) => (v ?? 0).toLocaleString(),
    'word-count-per-dir': (v) => (v ?? 0).toLocaleString(),
    'sitemap-orphans': (v) => (v ?? 0).toLocaleString(),
    'server-headers': (v) => (v ?? 0).toLocaleString(),
};
export function ReportsDialog({ open, onClose }) {
    const [kind, setKind] = useState('pages-per-dir');
    const [depth, setDepth] = useState(1);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            try {
                if (kind === 'pages-per-dir') {
                    const r = await window.freecrawl.reportsPagesPerDirectory({ depth, limit: 1000 });
                    if (!cancelled)
                        setRows(r.map((x) => ({ key: x.directory, count: x.count })));
                }
                else if (kind === 'status-codes') {
                    const r = await window.freecrawl.reportsStatusCodeHistogram();
                    if (!cancelled)
                        setRows(r.map((x) => ({
                            key: x.status === null ? 'No response' : String(x.status),
                            badge: statusBadge(x.status),
                            count: x.count,
                        })));
                }
                else if (kind === 'depth') {
                    const r = await window.freecrawl.reportsDepthHistogram();
                    if (!cancelled)
                        setRows(r.map((x) => ({ key: String(x.depth), count: x.count })));
                }
                else if (kind === 'response-time') {
                    const r = await window.freecrawl.reportsResponseTimeHistogram();
                    if (!cancelled)
                        setRows(r.map((x) => ({
                            key: x.label,
                            badge: rtBadge(x.label),
                            count: x.count,
                        })));
                }
                else if (kind === 'external-domain-health') {
                    const r = await window.freecrawl.reportsExternalDomainHealth(100);
                    if (!cancelled)
                        setRows(r.map((x) => ({
                            key: x.domain,
                            badge: x.errorRatePercent === 0
                                ? 'OK'
                                : x.errorRatePercent < 10
                                    ? 'WARN'
                                    : 'BAD',
                            // Bar = error count so the worst domains spike visually;
                            // value label shows the breakdown.
                            count: x.errorCount,
                            valueLabel: `${x.successCount}/${x.totalUrls} OK · ${x.errorRatePercent}% err${x.avgResponseTimeMs !== null ? ` · ${x.avgResponseTimeMs}ms avg` : ''}`,
                        })));
                }
                else if (kind === 'analytics-coverage') {
                    const r = await window.freecrawl.reportsAnalyticsCoverage();
                    if (!cancelled)
                        setRows(r.map((x) => ({
                            key: x.name,
                            count: x.pageCount,
                            valueLabel: `${x.pageCount.toLocaleString()} pages · ${x.distinctIds} distinct ID${x.distinctIds === 1 ? '' : 's'}${x.sampleIds.length > 0 ? ` · ${x.sampleIds.join(', ')}` : ''}`,
                        })));
                }
                else if (kind === 'link-positions') {
                    const r = await window.freecrawl.reportsLinkPositions();
                    if (!cancelled)
                        setRows(r.map((x) => ({
                            key: x.position,
                            count: x.count,
                        })));
                }
                else if (kind === 'image-weight') {
                    const r = await window.freecrawl.reportsImageWeightPerPage(25);
                    if (!cancelled)
                        setRows(r.map((x) => ({
                            key: x.url,
                            count: x.imageBytes,
                            valueLabel: `${VALUE_FORMAT['image-weight'](x.imageBytes)} · ${x.imageCount} image${x.imageCount === 1 ? '' : 's'}`,
                        })));
                }
                else if (kind === 'inlinks-histogram') {
                    const r = await window.freecrawl.reportsInlinksHistogram();
                    if (!cancelled)
                        setRows(r.map((x) => ({ key: x.label, count: x.count })));
                }
                else if (kind === 'word-count-histogram') {
                    const r = await window.freecrawl.reportsWordCountHistogram();
                    if (!cancelled)
                        setRows(r.map((x) => ({ key: x.label, count: x.count })));
                }
                else if (kind === 'url-length-histogram') {
                    const r = await window.freecrawl.reportsUrlLengthHistogram();
                    if (!cancelled)
                        setRows(r.map((x) => ({ key: x.label, count: x.count })));
                }
                else if (kind === 'word-count-per-dir') {
                    const r = await window.freecrawl.reportsWordCountPerDirectory({
                        depth,
                        limit: 1000,
                    });
                    if (!cancelled)
                        setRows(r.map((x) => ({
                            key: x.directory,
                            // Bar metric is the avg word count so the deepest-content
                            // directories visually spike; secondary value shows page
                            // count so the user can spot single-page outliers.
                            count: x.avgWordCount,
                            valueLabel: `${x.avgWordCount.toLocaleString()} avg · ${x.pageCount.toLocaleString()} page${x.pageCount === 1 ? '' : 's'}`,
                        })));
                }
                else if (kind === 'sitemap-orphans') {
                    const r = await window.freecrawl.reportsSitemapOrphans(1000);
                    if (!cancelled)
                        setRows(r.map((x) => ({
                            key: x.url,
                            // Constant bar (1) keeps every row visually equal — there
                            // is no metric to scale against; the meaning is "this URL
                            // is in the sitemap but never crawled". Lastmod + source
                            // sitemap go to the secondary value column.
                            count: 1,
                            valueLabel: [
                                x.lastmod ? `lastmod ${x.lastmod}` : null,
                                x.sourceSitemap ? `from ${x.sourceSitemap}` : null,
                            ]
                                .filter(Boolean)
                                .join(' · ') || '—',
                        })));
                }
                else if (kind === 'server-headers') {
                    const r = await window.freecrawl.reportsServerHeaders();
                    if (!cancelled)
                        setRows(r.map((x) => ({ key: x.server, count: x.count })));
                }
                else {
                    const metric = TOP_URL_METRIC[kind];
                    if (metric) {
                        const r = await window.freecrawl.reportsTopUrls({ metric, limit: 25 });
                        if (!cancelled)
                            setRows(r.map((x) => ({
                                key: x.url,
                                // Bar metric is the value itself (response time, inlinks, etc.).
                                count: x.value ?? 0,
                                valueLabel: VALUE_FORMAT[kind](x.value),
                            })));
                    }
                }
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [open, kind, depth]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open)
        return null;
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
    return (_jsx("div", { className: "fixed inset-0 z-30 flex items-center justify-center bg-black/60", onClick: onClose, children: _jsxs("div", { className: "flex max-h-[85vh] w-[760px] flex-col rounded-md border border-surface-700 bg-surface-900 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center border-b border-surface-800 px-4 py-2.5", children: [_jsx("div", { className: "text-sm font-semibold tracking-wide text-surface-100", children: REPORT_LABELS[kind] }), _jsx("button", { className: "ml-auto rounded p-1 text-surface-400 hover:bg-surface-800 hover:text-surface-100", onClick: onClose, title: "Close (Esc)", children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b border-surface-800 bg-surface-900/50 px-4 py-2 text-[11px]", children: [_jsxs("label", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-surface-400", children: "Report" }), _jsxs("select", { className: "rounded border border-surface-700 bg-surface-950 px-2 py-0.5 text-[11px] text-surface-100 focus:border-blue-500 focus:outline-none", value: kind, onChange: (e) => setKind(e.target.value), children: [_jsx("option", { value: "pages-per-dir", children: "Pages per Directory" }), _jsx("option", { value: "status-codes", children: "Status Code Histogram" }), _jsx("option", { value: "depth", children: "Depth Histogram" }), _jsx("option", { value: "response-time", children: "Response Time Histogram" }), _jsx("option", { value: "slowest-urls", children: "Slowest URLs (Top 25)" }), _jsx("option", { value: "most-inlinks", children: "Most-Linked URLs (Top 25)" }), _jsx("option", { value: "most-outlinks", children: "Most-Outlinking URLs (Top 25)" }), _jsx("option", { value: "biggest-pages", children: "Biggest Pages (Top 25)" }), _jsx("option", { value: "deepest-urls", children: "Deepest URLs (Top 25)" }), _jsx("option", { value: "external-domain-health", children: "External Domain Health" }), _jsx("option", { value: "analytics-coverage", children: "Analytics Tracker Coverage" }), _jsx("option", { value: "link-positions", children: "Internal Link Positions" }), _jsx("option", { value: "image-weight", children: "Image Weight per Page (Top 25)" }), _jsx("option", { value: "inlinks-histogram", children: "Inlinks Histogram" }), _jsx("option", { value: "word-count-histogram", children: "Word Count Histogram" }), _jsx("option", { value: "url-length-histogram", children: "URL Length Histogram" }), _jsx("option", { value: "word-count-per-dir", children: "Word Count per Directory" }), _jsx("option", { value: "sitemap-orphans", children: "Sitemap Orphans (Top 1000)" }), _jsx("option", { value: "server-headers", children: "Server Stack" })] })] }), (kind === 'pages-per-dir' || kind === 'word-count-per-dir') && (_jsxs("label", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-surface-400", children: "Group at depth" }), _jsxs("select", { className: "rounded border border-surface-700 bg-surface-950 px-2 py-0.5 text-[11px] text-surface-100 focus:border-blue-500 focus:outline-none", value: depth, onChange: (e) => setDepth(Number.parseInt(e.target.value, 10)), children: [_jsx("option", { value: 1, children: "1 (top-level)" }), _jsx("option", { value: 2, children: "2" }), _jsx("option", { value: 3, children: "3" }), _jsx("option", { value: 4, children: "4" })] })] })), _jsx("span", { className: "ml-auto text-surface-500", children: loading
                                ? 'Loading…'
                                : `${rows.length.toLocaleString()} rows · ${total.toLocaleString()} URLs` })] }), _jsxs("div", { className: "flex-1 overflow-auto px-4 py-3 text-[11px]", children: [rows.length === 0 && !loading && (_jsx("div", { className: "p-6 text-center text-surface-500", children: "No data \u2014 run a crawl first." })), rows.length > 0 && (_jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "sticky top-0 bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "w-2/3 py-1 pr-3 text-left font-medium", children: KEY_LABELS[kind] }), _jsx("th", { className: "w-24 py-1 pr-3 text-right font-medium", children: "Count" }), _jsx("th", { className: "py-1 text-left font-medium", children: "Share" })] }) }), _jsx("tbody", { children: rows.map((r) => {
                                        const widthPct = max > 0 ? Math.round((r.count / max) * 100) : 0;
                                        const sharePct = total > 0 ? ((r.count / total) * 100).toFixed(1) : '0.0';
                                        return (_jsxs("tr", { className: "border-b border-surface-900 last:border-0 hover:bg-surface-900/50", children: [_jsxs("td", { className: "break-all py-1 pr-3 align-top font-mono text-surface-100", children: [r.badge && (_jsx("span", { className: "mr-2 rounded bg-surface-800 px-1.5 py-0.5 text-[9px] uppercase text-surface-400", children: r.badge })), r.key] }), _jsx("td", { className: "py-1 pr-3 text-right align-top font-mono text-surface-100", children: r.valueLabel ?? r.count.toLocaleString() }), _jsx("td", { className: "py-1 align-top", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-1.5 w-32 rounded bg-surface-800", children: _jsx("div", { className: "h-full rounded bg-blue-600", style: { width: `${widthPct}%` } }) }), _jsxs("span", { className: "font-mono text-[10px] text-surface-400", children: [sharePct, "%"] })] }) })] }, r.key));
                                    }) })] }))] }), _jsx("div", { className: "flex items-center justify-end gap-2 border-t border-surface-800 px-4 py-2.5", children: _jsx("button", { className: "rounded border border-surface-700 px-3 py-1 text-[11px] hover:bg-surface-800", onClick: onClose, children: "Close" }) })] }) }));
}
function statusBadge(status) {
    if (status === null)
        return 'NET';
    if (status >= 200 && status < 300)
        return '2xx';
    if (status >= 300 && status < 400)
        return '3xx';
    if (status >= 400 && status < 500)
        return '4xx';
    if (status >= 500 && status < 600)
        return '5xx';
    return '?';
}
/**
 * One-letter perf class for a response-time bucket label. Lets users skim
 * the histogram for "where am I losing performance?" without re-reading
 * the bucket boundaries.
 */
function rtBadge(label) {
    if (label === 'No response')
        return 'ERR';
    if (label === '< 100ms' || label === '100–500ms')
        return 'OK';
    if (label === '500ms–1s')
        return 'WARN';
    return 'SLOW';
}
//# sourceMappingURL=ReportsDialog.js.map