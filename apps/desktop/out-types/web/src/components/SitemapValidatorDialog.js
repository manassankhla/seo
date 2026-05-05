import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store.js';
export function SitemapValidatorDialog({ open, onClose }) {
    const config = useAppStore((s) => s.config);
    const [url, setUrl] = useState('');
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    useEffect(() => {
        if (!open)
            return;
        // Pre-fill with the start URL's likely sitemap so a single-click run
        // works for the "did the site I just crawled have a valid sitemap?"
        // path that brings most users into this dialog.
        let suggested = '';
        if (config.startUrl) {
            try {
                suggested = new URL('/sitemap.xml', config.startUrl).toString();
            }
            catch {
                suggested = '';
            }
        }
        setUrl(suggested);
        setResult(null);
        setError(null);
    }, [open, config.startUrl]);
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
    async function runValidate() {
        if (!url.trim())
            return;
        setRunning(true);
        setError(null);
        try {
            const r = await window.freecrawl.sitemapValidate({
                url: url.trim(),
                userAgent: config.userAgent,
            });
            setResult(r);
        }
        catch (e) {
            setError(e.message);
            setResult(null);
        }
        finally {
            setRunning(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-30 flex items-center justify-center bg-black/60", onClick: onClose, children: _jsxs("div", { className: "flex max-h-[85vh] w-[760px] flex-col rounded-md border border-surface-700 bg-surface-900 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center border-b border-surface-800 px-4 py-2.5", children: [_jsx("div", { className: "text-sm font-semibold tracking-wide text-surface-100", children: "Sitemap Validator" }), _jsx("button", { className: "ml-auto rounded p-1 text-surface-400 hover:bg-surface-800 hover:text-surface-100", onClick: onClose, title: "Close (Esc)", children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "flex-1 overflow-auto px-5 py-4 text-[12px]", children: [_jsxs("label", { className: "mb-3 flex flex-col gap-1", children: [_jsx("span", { className: "text-[10px] text-surface-400", children: "Sitemap URL" }), _jsx("input", { type: "text", className: "rounded border border-surface-700 bg-surface-950 px-2 py-1.5 text-[12px] text-surface-100 focus:border-blue-500 focus:outline-none", value: url, onChange: (e) => setUrl(e.target.value), onKeyDown: (e) => {
                                        if (e.key === 'Enter' && !running)
                                            void runValidate();
                                    }, placeholder: "https://example.com/sitemap.xml", spellCheck: false, autoFocus: true })] }), _jsxs("div", { className: "mb-4 flex items-center gap-2", children: [_jsx("button", { className: "rounded bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-50", onClick: runValidate, disabled: running || !url.trim(), children: running ? 'Validating…' : 'Validate' }), _jsx("span", { className: "text-[10px] text-surface-500", children: "Walks nested sitemap-index entries up to depth 3 / 100K URLs." })] }), error && (_jsx("div", { className: "mb-3 rounded border border-red-700/60 bg-red-900/20 px-3 py-2 text-[11px] text-red-200", children: error })), result && (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: clsx('rounded border px-3 py-2 text-[12px]', result.findings.length === 0 && result.errors.length === 0
                                        ? 'border-emerald-700/60 bg-emerald-900/20 text-emerald-200'
                                        : 'border-amber-700/60 bg-amber-900/20 text-amber-200'), children: result.findings.length === 0 && result.errors.length === 0 ? (_jsxs("span", { children: ["\u2713 ", _jsx("strong", { children: "Valid" }), " \u2014 ", result.urlCount.toLocaleString(), " URL", result.urlCount === 1 ? '' : 's', result.truncated ? ' (truncated)' : ''] })) : (_jsxs("span", { children: ["\u26A0 ", _jsxs("strong", { children: [result.findings.length + result.errors.length, " finding(s)"] }), result.urlCount > 0
                                                ? ` — ${result.urlCount.toLocaleString()} URL${result.urlCount === 1 ? '' : 's'} parsed`
                                                : ''] })) }), _jsxs("div", { className: "grid grid-cols-3 gap-2 text-[11px]", children: [_jsx(Stat, { label: "Sitemaps tried", value: String(result.sitemapsTried.length) }), _jsx(Stat, { label: "Sitemaps parsed", value: String(result.sitemapsParsed.length) }), _jsx(Stat, { label: "URL entries", value: result.urlCount.toLocaleString() })] }), result.findings.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "mb-1 text-[10px] font-medium uppercase tracking-wider text-amber-300", children: "Findings" }), _jsx("ul", { className: "space-y-1 rounded border border-surface-800 bg-surface-950 p-2 font-mono text-[10px] text-amber-100", children: result.findings.map((f, i) => (_jsxs("li", { children: ["\u2022 ", f] }, i))) })] })), result.errors.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "mb-1 text-[10px] font-medium uppercase tracking-wider text-red-300", children: "Fetch errors" }), _jsx("ul", { className: "space-y-1 rounded border border-surface-800 bg-surface-950 p-2 font-mono text-[10px] text-red-100", children: result.errors.map((e, i) => (_jsxs("li", { className: "break-all", children: [_jsx("span", { className: "text-surface-400", children: e.sitemap }), ": ", e.error] }, i))) })] })), result.lastmodSamples.length > 0 && (_jsxs("details", { className: "text-[11px] text-surface-300", children: [_jsxs("summary", { className: "cursor-pointer text-surface-400 hover:text-surface-100", children: ["Sample lastmod values (", result.lastmodSamples.length, ")"] }), _jsx("ul", { className: "mt-1 space-y-0.5 pl-4 font-mono text-[10px]", children: result.lastmodSamples.map((s, i) => (_jsx("li", { className: "break-all", children: s }, i))) })] })), result.sitemapsTried.length > 0 && (_jsxs("details", { className: "text-[11px] text-surface-300", children: [_jsxs("summary", { className: "cursor-pointer text-surface-400 hover:text-surface-100", children: ["Sitemaps walked (", result.sitemapsTried.length, ")"] }), _jsx("ul", { className: "mt-1 space-y-0.5 pl-4 font-mono text-[10px]", children: result.sitemapsTried.map((s) => (_jsx("li", { className: "break-all", children: s }, s))) })] }))] }))] }), _jsx("div", { className: "flex items-center justify-end gap-2 border-t border-surface-800 px-4 py-2.5", children: _jsx("button", { className: "rounded border border-surface-700 px-3 py-1 text-[11px] hover:bg-surface-800", onClick: onClose, children: "Close" }) })] }) }));
}
function Stat({ label, value }) {
    return (_jsxs("div", { className: "flex items-center justify-between rounded border border-surface-800 bg-surface-950 px-2 py-1", children: [_jsx("span", { className: "text-surface-400", children: label }), _jsx("span", { className: "font-mono text-surface-100", children: value })] }));
}
//# sourceMappingURL=SitemapValidatorDialog.js.map