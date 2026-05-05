import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store.js';
export function RobotsTesterDialog({ open, onClose }) {
    const config = useAppStore((s) => s.config);
    const [url, setUrl] = useState('');
    const [userAgent, setUserAgent] = useState(config.userAgent);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    // Custom-policy mode lets the user paste a draft robots.txt and test it
    // against URLs without deploying. Off by default so the basic flow
    // (probe live robots.txt) still works in one click.
    const [useCustom, setUseCustom] = useState(false);
    const [customRobots, setCustomRobots] = useState('');
    // Re-seed inputs whenever the dialog opens — pre-fills the URL with the
    // current crawl's start URL (handy: most "why is this blocked?" checks
    // are about the very URL you just tried to crawl) and the user agent
    // with whatever Settings has saved.
    useEffect(() => {
        if (!open)
            return;
        setUrl(config.startUrl || '');
        setUserAgent(config.userAgent);
        setResult(null);
    }, [open, config.startUrl, config.userAgent]);
    // ESC closes — common modal expectation.
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
    async function runTest() {
        if (!url.trim())
            return;
        setRunning(true);
        try {
            const r = await window.freecrawl.robotsTest({
                url: url.trim(),
                userAgent,
                customRobots: useCustom ? customRobots : undefined,
            });
            setResult(r);
        }
        finally {
            setRunning(false);
        }
    }
    async function loadFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,text/plain,robots.txt';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file)
                return;
            const text = await file.text();
            setCustomRobots(text);
            setUseCustom(true);
        };
        input.click();
    }
    return (_jsx("div", { className: "fixed inset-0 z-30 flex items-center justify-center bg-black/60", onClick: onClose, children: _jsxs("div", { className: "flex max-h-[85vh] w-[720px] flex-col rounded-md border border-surface-700 bg-surface-900 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center border-b border-surface-800 px-4 py-2.5", children: [_jsx("div", { className: "text-sm font-semibold tracking-wide text-surface-100", children: "Robots.txt Tester" }), _jsx("button", { className: "ml-auto rounded p-1 text-surface-400 hover:bg-surface-800 hover:text-surface-100", onClick: onClose, title: "Close (Esc)", children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "flex-1 overflow-auto px-5 py-4 text-[12px]", children: [_jsxs("label", { className: "mb-3 flex flex-col gap-1", children: [_jsx("span", { className: "text-[10px] text-surface-400", children: "URL to test" }), _jsx("input", { type: "text", className: "rounded border border-surface-700 bg-surface-950 px-2 py-1.5 text-[12px] text-surface-100 focus:border-blue-500 focus:outline-none", value: url, onChange: (e) => setUrl(e.target.value), onKeyDown: (e) => {
                                        if (e.key === 'Enter' && !running)
                                            void runTest();
                                    }, placeholder: "https://example.com/some/path", spellCheck: false, autoFocus: true })] }), _jsxs("label", { className: "mb-3 flex flex-col gap-1", children: [_jsx("span", { className: "text-[10px] text-surface-400", children: "User-Agent" }), _jsx("input", { type: "text", className: "rounded border border-surface-700 bg-surface-950 px-2 py-1.5 text-[12px] text-surface-100 focus:border-blue-500 focus:outline-none", value: userAgent, onChange: (e) => setUserAgent(e.target.value), spellCheck: false })] }), _jsxs("div", { className: "mb-3 flex items-center gap-2 rounded border border-surface-800 bg-surface-950 px-2 py-1.5", children: [_jsxs("label", { className: "flex items-center gap-1.5 text-[11px] text-surface-300", children: [_jsx("input", { type: "checkbox", checked: useCustom, onChange: (e) => setUseCustom(e.target.checked), className: "h-3 w-3" }), "Test against a custom robots.txt (draft mode)"] }), _jsx("button", { type: "button", className: "ml-auto rounded border border-surface-700 px-2 py-0.5 text-[10px] hover:bg-surface-800", onClick: () => void loadFromFile(), disabled: running, children: "Load from file\u2026" })] }), useCustom && (_jsxs("label", { className: "mb-3 flex flex-col gap-1", children: [_jsx("span", { className: "text-[10px] text-surface-400", children: "Custom robots.txt body (parsed \u2014 no fetch)" }), _jsx("textarea", { className: "h-40 w-full resize-y rounded border border-surface-700 bg-surface-950 px-2 py-1.5 font-mono text-[11px] text-surface-100 focus:border-blue-500 focus:outline-none", value: customRobots, onChange: (e) => setCustomRobots(e.target.value), placeholder: `User-agent: *\nDisallow: /admin/\nDisallow: /private/\nSitemap: https://example.com/sitemap.xml`, spellCheck: false })] })), _jsxs("div", { className: "mb-4 flex items-center gap-2", children: [_jsx("button", { className: "rounded bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-50", onClick: runTest, disabled: running || !url.trim(), children: running ? 'Testing…' : useCustom ? 'Test (custom)' : 'Test' }), result?.robotsUrl && (_jsxs("span", { className: "text-[10px] text-surface-500", children: ["robots.txt: ", _jsx("span", { className: "font-mono text-surface-300", children: result.robotsUrl }), result.status !== null && result.status > 0 && (_jsxs("span", { className: "ml-2", children: ["\u2192 HTTP ", result.status] }))] }))] }), result && (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: clsx('rounded border px-3 py-2 text-[12px]', result.allowed
                                        ? 'border-emerald-700/60 bg-emerald-900/20 text-emerald-200'
                                        : 'border-red-700/60 bg-red-900/20 text-red-200'), children: result.allowed ? (_jsxs("span", { children: ["\u2713 ", _jsx("strong", { children: "Allowed" }), " by robots.txt for User-Agent", ' ', _jsx("code", { className: "font-mono", children: userAgent })] })) : (_jsxs("span", { children: ["\u2717 ", _jsx("strong", { children: "Disallowed" }), " by robots.txt for User-Agent", ' ', _jsx("code", { className: "font-mono", children: userAgent })] })) }), result.error && (_jsx("div", { className: "rounded border border-amber-700/60 bg-amber-900/20 px-3 py-2 text-[11px] text-amber-200", children: result.error })), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-[11px]", children: [_jsx(Stat, { label: "Crawl-Delay", value: result.crawlDelay !== null ? `${result.crawlDelay}s` : '—' }), _jsx(Stat, { label: "Sitemaps declared", value: String(result.sitemaps.length) })] }), result.sitemaps.length > 0 && (_jsxs("details", { className: "text-[11px] text-surface-300", children: [_jsxs("summary", { className: "cursor-pointer text-surface-400 hover:text-surface-100", children: ["Sitemaps (", result.sitemaps.length, ")"] }), _jsx("ul", { className: "mt-1 space-y-0.5 pl-4 font-mono", children: result.sitemaps.map((s) => (_jsx("li", { className: "break-all", children: s }, s))) })] })), result.body !== null && (_jsxs("details", { className: "text-[11px] text-surface-300", children: [_jsxs("summary", { className: "cursor-pointer text-surface-400 hover:text-surface-100", children: ["robots.txt body (", result.body.length, " chars)"] }), _jsx("pre", { className: "mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-surface-800 bg-surface-950 p-2 font-mono text-[10px] text-surface-200", children: result.body })] }))] }))] }), _jsx("div", { className: "flex items-center justify-end gap-2 border-t border-surface-800 px-4 py-2.5", children: _jsx("button", { className: "rounded border border-surface-700 px-3 py-1 text-[11px] hover:bg-surface-800", onClick: onClose, children: "Close" }) })] }) }));
}
function Stat({ label, value }) {
    return (_jsxs("div", { className: "flex items-center justify-between rounded border border-surface-800 bg-surface-950 px-2 py-1", children: [_jsx("span", { className: "text-surface-400", children: label }), _jsx("span", { className: "font-mono text-surface-100", children: value })] }));
}
//# sourceMappingURL=RobotsTesterDialog.js.map