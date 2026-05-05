import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Info } from 'lucide-react';
/**
 * Hover/focus tooltip used next to setting labels and table column
 * headers. Renders an [i] icon; the popover surfaces a description and
 * an optional concrete example. `pointer-events-none` lets the mouse
 * pass through, so hovering the icon doesn't block clicks on the
 * column-header sort/resize controls underneath.
 */
export function InfoTip({ info, example }) {
    if (!info && !example)
        return null;
    return (_jsxs("span", { className: "group relative inline-flex", children: [_jsx(Info, { className: "h-3 w-3 cursor-help text-surface-500 transition-colors group-hover:text-surface-200", tabIndex: 0, "aria-label": info ?? 'More info' }), _jsxs("span", { className: "pointer-events-none invisible absolute left-4 top-0 z-50 w-64 rounded border border-surface-700 bg-surface-900 p-2 text-[10px] leading-relaxed text-surface-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100", children: [info && _jsx("span", { className: "block", children: info }), example && (_jsxs(_Fragment, { children: [_jsx("span", { className: "mt-1.5 block text-[9px] font-semibold uppercase tracking-wider text-surface-500", children: "Example" }), _jsx("span", { className: "mt-0.5 block break-words font-mono text-[10px] text-surface-300", children: example })] }))] })] }));
}
//# sourceMappingURL=InfoTip.js.map