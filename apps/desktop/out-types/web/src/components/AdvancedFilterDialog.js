import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
const FIELDS = [
    { value: 'url', label: 'Address (URL)' },
    { value: 'content_kind', label: 'Type' },
    { value: 'status_code', label: 'Status Code', numeric: true },
    { value: 'indexability', label: 'Indexability' },
    { value: 'title', label: 'Title' },
    { value: 'title_length', label: 'Title Length', numeric: true },
    { value: 'meta_description', label: 'Meta Description' },
    { value: 'meta_description_length', label: 'Meta Description Length', numeric: true },
    { value: 'h1', label: 'H1' },
    { value: 'h1_length', label: 'H1 Length', numeric: true },
    { value: 'h1_count', label: 'H1 Count', numeric: true },
    { value: 'h2_count', label: 'H2 Count', numeric: true },
    { value: 'word_count', label: 'Word Count', numeric: true },
    { value: 'content_type', label: 'Content Type' },
    { value: 'content_length', label: 'Size (Bytes)', numeric: true },
    { value: 'response_time_ms', label: 'Response Time (ms)', numeric: true },
    { value: 'depth', label: 'Crawl Depth', numeric: true },
    { value: 'inlinks', label: 'Inlinks', numeric: true },
    { value: 'outlinks', label: 'Outlinks', numeric: true },
    { value: 'canonical', label: 'Canonical' },
    { value: 'meta_robots', label: 'Meta Robots' },
    { value: 'x_robots_tag', label: 'X-Robots-Tag' },
    { value: 'redirect_target', label: 'Redirect URL' },
    { value: 'images_count', label: 'Images Count', numeric: true },
    { value: 'images_missing_alt', label: 'Imgs Missing Alt', numeric: true },
];
const TEXT_OPS = [
    { value: 'contains', label: 'Contains (~)' },
    { value: 'not_contains', label: "Does Not Contain (≠~)" },
    { value: 'equals', label: 'Equals (=)' },
    { value: 'not_equals', label: 'Does Not Equal (≠)' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
];
const NUMERIC_OPS = [
    { value: 'equals', label: 'Equals (=)' },
    { value: 'not_equals', label: 'Not Equal (≠)' },
    { value: 'gt', label: 'Greater Than (>)' },
    { value: 'gte', label: 'Greater or Equal (≥)' },
    { value: 'lt', label: 'Less Than (<)' },
    { value: 'lte', label: 'Less or Equal (≤)' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
];
const NO_VALUE_OPS = ['is_empty', 'is_not_empty'];
function isNumericField(field) {
    return FIELDS.find((f) => f.value === field)?.numeric ?? false;
}
function emptyClause() {
    return { field: 'url', operator: 'contains', value: '' };
}
function emptyGroup() {
    return { clauses: [emptyClause()] };
}
export function AdvancedFilterDialog({ open, initial, onClose, onApply, }) {
    const [groups, setGroups] = useState(() => initial && initial.groups.length > 0 ? clone(initial.groups) : [emptyGroup()]);
    // Re-seed each time the dialog reopens so cancelling really discards.
    useEffect(() => {
        if (open) {
            setGroups(initial && initial.groups.length > 0 ? clone(initial.groups) : [emptyGroup()]);
        }
    }, [open, initial]);
    if (!open)
        return null;
    const updateClause = (groupIdx, clauseIdx, patch) => {
        setGroups((prev) => prev.map((g, gi) => gi !== groupIdx
            ? g
            : {
                ...g,
                clauses: g.clauses.map((c, ci) => ci !== clauseIdx ? c : applyPatch(c, patch)),
            }));
    };
    const addClause = (groupIdx) => {
        setGroups((prev) => prev.map((g, gi) => gi !== groupIdx ? g : { ...g, clauses: [...g.clauses, emptyClause()] }));
    };
    const deleteClause = (groupIdx, clauseIdx) => {
        setGroups((prev) => {
            const updated = prev.map((g, gi) => gi !== groupIdx
                ? g
                : { ...g, clauses: g.clauses.filter((_, ci) => ci !== clauseIdx) });
            // Drop the whole group if it has no clauses left, and make sure we
            // always leave at least one editable group/clause behind.
            const trimmed = updated.filter((g) => g.clauses.length > 0);
            return trimmed.length > 0 ? trimmed : [emptyGroup()];
        });
    };
    const addGroup = () => setGroups((prev) => [...prev, emptyGroup()]);
    const deleteGroup = (groupIdx) => {
        setGroups((prev) => {
            const next = prev.filter((_, gi) => gi !== groupIdx);
            return next.length > 0 ? next : [emptyGroup()];
        });
    };
    const reset = () => setGroups([emptyGroup()]);
    const apply = () => {
        const cleaned = [];
        for (const g of groups) {
            const clauses = g.clauses.filter((c) => {
                if (NO_VALUE_OPS.includes(c.operator))
                    return true;
                return c.value.trim().length > 0;
            });
            if (clauses.length > 0)
                cleaned.push({ clauses });
        }
        onApply(cleaned.length > 0 ? { groups: cleaned } : null);
        onClose();
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60", onClick: onClose, children: _jsxs("div", { className: "flex max-h-[80vh] w-[820px] max-w-[95vw] flex-col rounded-md border border-surface-700 bg-surface-900 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between border-b border-surface-800 px-4 py-2.5", children: [_jsx("div", { className: "text-sm font-semibold text-surface-100", children: "Advanced Table Search" }), _jsx("button", { className: "rounded p-1 text-surface-400 hover:bg-surface-800 hover:text-surface-100", onClick: onClose, title: "Close", children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "flex-1 space-y-3 overflow-auto p-4", children: [groups.map((group, gi) => (_jsxs("div", { className: "rounded border border-surface-800 bg-surface-950/50 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-surface-500", children: gi === 0 ? 'Where' : 'Or Where' }), groups.length > 1 && (_jsx("button", { className: "rounded p-1 text-surface-500 hover:bg-surface-800 hover:text-red-300", onClick: () => deleteGroup(gi), title: "Remove group", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) }))] }), _jsx("div", { className: "space-y-2", children: group.clauses.map((clause, ci) => (_jsx(ClauseRow, { clause: clause, showAndLabel: ci > 0, onChange: (patch) => updateClause(gi, ci, patch), onDelete: () => deleteClause(gi, ci) }, ci))) }), _jsx("div", { className: "mt-2 flex justify-center", children: _jsxs("button", { className: "inline-flex items-center gap-1 rounded border border-accent-500/50 bg-accent-500/10 px-2 py-1 text-[11px] text-accent-300 hover:bg-accent-500/20", onClick: () => addClause(gi), title: "Add another AND condition to this group", children: [_jsx(Plus, { className: "h-3 w-3" }), " AND"] }) })] }, gi))), _jsx("div", { className: "flex justify-center", children: _jsxs("button", { className: "inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20", onClick: addGroup, title: "Add an OR group", children: [_jsx(Plus, { className: "h-3 w-3" }), " OR"] }) })] }), _jsxs("div", { className: "flex items-center justify-between border-t border-surface-800 px-4 py-2.5", children: [_jsx("button", { className: "inline-flex items-center gap-1 rounded border border-red-700/50 bg-red-900/30 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-900/50", onClick: reset, children: "Reset" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { className: "rounded border border-surface-700 px-3 py-1 text-[11px] text-surface-300 hover:bg-surface-800", onClick: onClose, children: "Cancel" }), _jsx("button", { className: "rounded bg-accent-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-accent-600", onClick: apply, children: "OK" })] })] })] }) }));
}
function ClauseRow({ clause, showAndLabel, onChange, onDelete, }) {
    const numeric = isNumericField(clause.field);
    const operators = numeric ? NUMERIC_OPS : TEXT_OPS;
    const needsValue = !NO_VALUE_OPS.includes(clause.operator);
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: clsx('w-12 text-[10px] font-semibold uppercase tracking-wide', showAndLabel ? 'text-surface-500' : 'text-transparent'), children: showAndLabel ? 'And' : '—' }), _jsx("select", { className: "input w-52", value: clause.field, onChange: (e) => {
                    const field = e.target.value;
                    // Switching field may make the current operator invalid — reset
                    // to a safe default for the new field type.
                    const nextOps = isNumericField(field) ? NUMERIC_OPS : TEXT_OPS;
                    const opStillValid = nextOps.some((o) => o.value === clause.operator);
                    onChange({
                        field,
                        operator: opStillValid ? clause.operator : nextOps[0].value,
                    });
                }, children: FIELDS.map((f) => (_jsx("option", { value: f.value, children: f.label }, f.value))) }), _jsx("select", { className: "input w-48", value: clause.operator, onChange: (e) => onChange({ operator: e.target.value }), children: operators.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) }), needsValue ? (_jsx("input", { className: "input flex-1", type: numeric ? 'number' : 'text', placeholder: numeric ? '0' : 'Enter search query', value: clause.value, onChange: (e) => onChange({ value: e.target.value }), spellCheck: false })) : (_jsx("div", { className: "flex-1 text-[11px] text-surface-600", children: "(no value required)" })), _jsx("button", { className: "rounded p-1 text-surface-500 hover:bg-surface-800 hover:text-red-300", onClick: onDelete, title: "Remove condition", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })] }));
}
function applyPatch(c, patch) {
    return { ...c, ...patch };
}
function clone(groups) {
    return groups.map((g) => ({ clauses: g.clauses.map((c) => ({ ...c })) }));
}
//# sourceMappingURL=AdvancedFilterDialog.js.map