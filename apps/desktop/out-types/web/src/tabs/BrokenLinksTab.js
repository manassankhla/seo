import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { useAppStore } from '../store.js';
import { InfoTip } from '../components/InfoTip.js';
const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 28;
const ROW_NUM_WIDTH = 56;
const STATUS_BAR_HEIGHT = 22;
// I-4 — Crawl-aware polling cadence. Live during a crawl, idle when
// just viewing existing project data. The 30 s idle poll exists only
// to catch external invalidations (Open Project, Bulk Export); the
// crawler's per-50-URL push refetch handles the live case.
const POLL_MS_RUNNING = 3000;
const POLL_MS_IDLE = 30_000;
const PAGE_SIZE = 5000;
export function BrokenLinksTab() {
    const activeCategory = useAppStore((s) => s.activeCategory);
    const dataVersion = useAppStore((s) => s.dataVersion);
    const progress = useAppStore((s) => s.progress);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const scrollRef = useRef(null);
    // The sidebar toggles between "all", "internal-only", and "external-only"
    // via activeCategory; everything else stays "all".
    const internal = activeCategory === 'issues:broken-links-internal'
        ? 'internal'
        : activeCategory === 'issues:broken-links-external'
            ? 'external'
            : 'all';
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const res = await window.freecrawl.brokenLinksQuery({
                limit: PAGE_SIZE,
                offset: 0,
                search: search || undefined,
                internal,
            });
            if (cancelled)
                return;
            setRows(res.rows);
            setTotal(res.total);
        };
        void load();
        const cadence = progress?.running ? POLL_MS_RUNNING : POLL_MS_IDLE;
        const id = setInterval(load, cadence);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [search, internal, dataVersion, progress?.running]);
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 30,
        getItemKey: (index) => {
            const r = rows[index];
            return r ? `${r.fromUrl}|${r.toUrl}|${index}` : `idx-${index}`;
        },
    });
    const columns = [
        {
            key: 'fromUrl',
            label: 'Source URL',
            width: 400,
            info: 'Page that contains the broken link.',
            example: 'https://example.com/blog/post-1',
        },
        {
            key: 'fromStatus',
            label: 'Source Status',
            width: 110,
            align: 'right',
            info: 'HTTP status of the source page itself. Usually 200; if non-2xx the broken link may be inherited.',
            example: '200',
        },
        {
            key: 'toUrl',
            label: 'Target URL',
            width: 400,
            info: 'The URL that fails to resolve (4xx/5xx/network error).',
            example: 'https://other.com/missing-page',
        },
        {
            key: 'toStatus',
            label: 'Target Status',
            width: 110,
            align: 'right',
            info: 'HTTP status returned by the target. 0 = network failure (DNS, TLS, timeout).',
            example: '404',
        },
        {
            key: 'anchor',
            label: 'Anchor',
            width: 240,
            info: 'Anchor text of the broken link as rendered in the source page.',
            example: 'Read the full article →',
        },
        {
            key: 'isInternal',
            label: 'Type',
            width: 80,
            info: 'Whether the broken target is on the same site (internal) or a different host (external).',
            example: 'internal / external',
        },
    ];
    const totalWidth = ROW_NUM_WIDTH + columns.reduce((n, c) => n + c.width, 0);
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "flex shrink-0 items-center gap-2 border-b border-surface-800 bg-surface-900/30 px-3 py-1.5", children: [_jsx("input", { className: "input w-96", placeholder: "Search source / target\u2026", value: search, onChange: (e) => setSearch(e.target.value), spellCheck: false }), internal !== 'all' && (_jsx("span", { className: "rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300", children: internal === 'internal' ? 'Internal only' : 'External only' })), _jsxs("div", { className: "ml-auto text-[11px] text-surface-500", children: [_jsx("span", { className: "font-mono text-surface-200", children: total.toLocaleString() }), " broken links", _jsxs("span", { className: "ml-2 text-surface-600", children: ["(", rows.length.toLocaleString(), " loaded)"] })] })] }), _jsxs("div", { ref: scrollRef, className: "relative flex-1 select-none overflow-auto", children: [_jsxs("div", { style: { minWidth: totalWidth, width: '100%' }, children: [_jsxs("div", { className: "sticky top-0 z-10 flex bg-surface-900 text-[11px]", style: { minWidth: totalWidth, width: '100%', height: HEADER_HEIGHT }, children: [_jsx("div", { className: "flex items-center justify-end border-b border-r border-surface-800 px-2 font-medium text-surface-400", style: {
                                            width: ROW_NUM_WIDTH,
                                            minWidth: ROW_NUM_WIDTH,
                                            flex: `0 0 ${ROW_NUM_WIDTH}px`,
                                        }, children: "Row" }), columns.map((c) => (_jsxs("div", { className: "flex items-center gap-1 border-b border-r border-surface-800 pl-2 pr-3 font-medium text-surface-300", style: { width: c.width, minWidth: c.width, flex: `0 0 ${c.width}px` }, children: [_jsx("span", { className: clsx('truncate', c.align === 'right' && 'ml-auto'), children: c.label }), (c.info || c.example) && (_jsx("span", { className: "shrink-0", children: _jsx(InfoTip, { info: c.info, example: c.example }) }))] }, c.key))), _jsx("div", { className: "flex-1 border-b border-surface-800" })] }), _jsx("div", { className: "relative", style: {
                                    height: virtualizer.getTotalSize(),
                                    minWidth: totalWidth,
                                    width: '100%',
                                }, children: virtualizer.getVirtualItems().map((vi) => {
                                    const row = rows[vi.index];
                                    if (!row)
                                        return null;
                                    return (_jsxs("div", { "data-index": vi.index, className: "absolute left-0 top-0 flex items-center border-b border-surface-900 text-[11px] hover:bg-surface-900/60", style: {
                                            transform: `translateY(${vi.start}px)`,
                                            height: ROW_HEIGHT,
                                            minWidth: totalWidth,
                                            width: '100%',
                                        }, children: [_jsx("div", { className: "flex items-center justify-end overflow-hidden border-r border-surface-900 px-2 font-mono tabular-nums text-surface-500", style: {
                                                    width: ROW_NUM_WIDTH,
                                                    minWidth: ROW_NUM_WIDTH,
                                                    flex: `0 0 ${ROW_NUM_WIDTH}px`,
                                                }, children: vi.index + 1 }), _jsx("div", { className: "overflow-hidden px-2", style: {
                                                    width: columns[0].width,
                                                    minWidth: columns[0].width,
                                                    flex: `0 0 ${columns[0].width}px`,
                                                }, children: _jsx("span", { className: "block truncate font-mono text-surface-100", title: row.fromUrl, children: row.fromUrl }) }), _jsx("div", { className: "overflow-hidden px-2 text-right", style: {
                                                    width: columns[1].width,
                                                    minWidth: columns[1].width,
                                                    flex: `0 0 ${columns[1].width}px`,
                                                }, children: _jsx("span", { className: clsx('inline-block rounded px-1.5 font-mono text-[10px]', statusClasses(row.fromStatusCode)), children: row.fromStatusCode ?? '—' }) }), _jsx("div", { className: "overflow-hidden px-2", style: {
                                                    width: columns[2].width,
                                                    minWidth: columns[2].width,
                                                    flex: `0 0 ${columns[2].width}px`,
                                                }, children: _jsx("span", { className: "block truncate font-mono text-surface-100", title: row.toUrl, children: row.toUrl }) }), _jsx("div", { className: "overflow-hidden px-2 text-right", style: {
                                                    width: columns[3].width,
                                                    minWidth: columns[3].width,
                                                    flex: `0 0 ${columns[3].width}px`,
                                                }, children: _jsx("span", { className: clsx('inline-block rounded px-1.5 font-mono text-[10px]', statusClasses(row.toStatusCode)), children: row.toStatusCode ?? '—' }) }), _jsx("div", { className: "overflow-hidden px-2", style: {
                                                    width: columns[4].width,
                                                    minWidth: columns[4].width,
                                                    flex: `0 0 ${columns[4].width}px`,
                                                }, children: _jsx("span", { className: "block truncate text-surface-200", title: row.anchor ?? undefined, children: row.anchor ?? _jsx("span", { className: "text-surface-700", children: "\u2014" }) }) }), _jsx("div", { className: "overflow-hidden px-2", style: {
                                                    width: columns[5].width,
                                                    minWidth: columns[5].width,
                                                    flex: `0 0 ${columns[5].width}px`,
                                                }, children: _jsx("span", { className: clsx('text-[10px]', row.isInternal ? 'text-surface-300' : 'text-surface-500'), children: row.isInternal ? 'internal' : 'external' }) }), _jsx("div", { className: "flex-1" })] }, vi.key));
                                }) })] }), total === 0 && (_jsx("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center", style: { top: HEADER_HEIGHT }, children: _jsxs("div", { className: "max-w-md text-center", children: [_jsx("div", { className: "mb-1 text-sm font-semibold text-surface-300", children: "No broken links" }), _jsx("div", { className: "text-xs text-surface-500", children: "Every link in the crawl resolves to a healthy response." })] }) }))] }), _jsx("div", { className: "flex shrink-0 items-center justify-end gap-4 border-t border-surface-800 bg-surface-900/60 px-3 text-[11px] text-surface-400", style: { height: STATUS_BAR_HEIGHT }, children: _jsxs("span", { children: ["Total:", ' ', _jsx("span", { className: "font-mono tabular-nums text-surface-200", children: total.toLocaleString() })] }) })] }));
}
function statusClasses(code) {
    if (code === null)
        return 'bg-surface-800 text-surface-400';
    if (code >= 400 && code < 500)
        return 'bg-orange-900/60 text-orange-300';
    if (code >= 500)
        return 'bg-red-900/60 text-red-300';
    if (code >= 300 && code < 400)
        return 'bg-amber-900/60 text-amber-300';
    if (code >= 200 && code < 300)
        return 'bg-emerald-900/60 text-emerald-300';
    return 'bg-surface-800 text-surface-400';
}
//# sourceMappingURL=BrokenLinksTab.js.map