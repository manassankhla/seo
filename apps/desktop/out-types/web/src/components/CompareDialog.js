import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { X, FolderOpen, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
const CATEGORIES = [
    { key: 'added', label: 'Added' },
    { key: 'removed', label: 'Removed' },
    { key: 'status', label: 'Status Changed' },
    { key: 'title', label: 'Title Changed' },
    { key: 'meta', label: 'Meta Description Changed' },
    { key: 'h1', label: 'H1 Changed' },
    { key: 'canonical', label: 'Canonical Changed' },
    { key: 'indexability', label: 'Indexability Changed' },
    { key: 'response_time', label: 'Response Time Δ' },
];
export function CompareDialog({ open, onClose }) {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState('added');
    const [error, setError] = useState(null);
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
    // Auto-trigger the file picker the first time the dialog opens — this
    // is a "Compare With Project…" affordance, the user already
    // committed to picking a file when they clicked the menu item.
    useEffect(() => {
        if (!open)
            return;
        setError(null);
        setResult(null);
        void pick();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    async function pick() {
        setLoading(true);
        setError(null);
        try {
            const r = await window.freecrawl.compareLoad({});
            if (!r.filePath) {
                // User cancelled the file dialog.
                onClose();
                return;
            }
            setResult(r);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setLoading(false);
        }
    }
    if (!open)
        return null;
    const sample = result?.samples.filter((r) => r.category === active) ?? [];
    return (_jsx("div", { className: "fixed inset-0 z-30 flex items-center justify-center bg-black/60", onClick: onClose, children: _jsxs("div", { className: "flex h-[80vh] max-h-[760px] w-[1080px] max-w-[95vw] flex-col overflow-hidden rounded-md border border-surface-700 bg-surface-900 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center border-b border-surface-800 px-4 py-2.5", children: [_jsx("div", { className: "text-sm font-semibold tracking-wide text-surface-100", children: "Compare Crawls" }), result && (_jsxs("div", { className: "ml-3 truncate text-[11px] text-surface-400", children: [_jsx("span", { className: "text-surface-500", children: "A (current)" }), ' ', result.totalA.toLocaleString(), " URLs \u00B7", ' ', _jsx("span", { className: "text-surface-500", children: "B" }), ' ', result.totalB.toLocaleString(), " URLs \u00B7 ", result.filePath] })), _jsxs("div", { className: "ml-auto flex items-center gap-1", children: [_jsxs("button", { className: "flex items-center gap-1 rounded border border-surface-700 px-2 py-1 text-[11px] text-surface-200 hover:border-blue-500 hover:bg-surface-800", onClick: pick, disabled: loading, title: "Pick a different project file", children: [loading ? (_jsx(RefreshCw, { className: "h-3 w-3 animate-spin" })) : (_jsx(FolderOpen, { className: "h-3 w-3" })), loading ? 'Comparing…' : 'Open Other Project'] }), _jsx("button", { className: "rounded p-1 text-surface-400 hover:bg-surface-800 hover:text-surface-100", onClick: onClose, title: "Close (Esc)", children: _jsx(X, { className: "h-4 w-4" }) })] })] }), error && (_jsx("div", { className: "border-b border-red-900 bg-red-950/40 px-4 py-2 text-[11px] text-red-300", children: error })), !result && !error && !loading && (_jsx("div", { className: "flex flex-1 items-center justify-center text-[12px] text-surface-500", children: "Pick a `.seoproject` file to diff against the current crawl." })), result && (_jsxs("div", { className: "flex flex-1 min-h-0", children: [_jsx("aside", { className: "flex w-56 flex-col border-r border-surface-800 bg-surface-950/40", children: _jsx("nav", { className: "flex-1 overflow-auto py-1", children: CATEGORIES.map((c) => {
                                    const count = result.counts[c.key] ?? 0;
                                    const isActive = c.key === active;
                                    return (_jsxs("button", { className: clsx('flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] transition-colors', isActive
                                            ? 'bg-accent-600/20 text-accent-200 border-l-2 border-accent-500'
                                            : 'border-l-2 border-transparent text-surface-300 hover:bg-surface-800 hover:text-surface-100', count === 0 && 'opacity-50'), onClick: () => setActive(c.key), children: [_jsx("span", { children: c.label }), _jsx("span", { className: "font-mono text-[10px] text-surface-400", children: count.toLocaleString() })] }, c.key));
                                }) }) }), _jsxs("div", { className: "flex flex-1 flex-col min-w-0", children: [_jsxs("div", { className: "border-b border-surface-800 px-4 py-2 text-[11px] text-surface-400", children: [sample.length.toLocaleString(), " of", ' ', (result.counts[active] ?? 0).toLocaleString(), " entries shown", result.counts[active] > sample.length && (_jsx("span", { className: "ml-1 text-surface-500", children: "(truncated \u2014 export CSV for the full set)" }))] }), _jsx("div", { className: "flex-1 overflow-auto", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "sticky top-0 bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "w-1/2 py-1.5 px-3 text-left font-medium", children: "URL" }), _jsx("th", { className: "w-1/4 py-1.5 px-3 text-left font-medium", children: "Before" }), _jsx("th", { className: "w-1/4 py-1.5 px-3 text-left font-medium", children: "After" })] }) }), _jsxs("tbody", { children: [sample.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 3, className: "px-3 py-3 text-center text-[11px] italic text-surface-500", children: "No diffs in this category." }) })), sample.map((r, i) => (_jsxs("tr", { className: "border-b border-surface-900/60 hover:bg-surface-800/40", children: [_jsx("td", { className: "py-1 px-3 font-mono text-[11px] text-surface-100", children: r.url }), _jsx("td", { className: "py-1 px-3 font-mono text-[11px] text-red-300", children: r.before === null ? (_jsx("span", { className: "text-surface-700", children: "\u2014" })) : (r.before) }), _jsx("td", { className: "py-1 px-3 font-mono text-[11px] text-emerald-300", children: r.after === null ? (_jsx("span", { className: "text-surface-700", children: "\u2014" })) : (r.after) })] }, `${r.url}-${i}`)))] })] }) })] })] }))] }) }));
}
//# sourceMappingURL=CompareDialog.js.map