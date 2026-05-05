import type { AdvancedFilter, CrawlUrlRow, UrlCategory } from '@freecrawl/shared-types';
export interface LazyRowsOpts {
    category: UrlCategory;
    search: string;
    sortBy: keyof CrawlUrlRow | undefined;
    sortDir: 'asc' | 'desc';
    /** Advanced multi-clause filter (AND within group, OR across groups). */
    filter?: AdvancedFilter;
    /** Bump to force a full rebuild (e.g. row removed via context menu). */
    refreshKey?: unknown;
}
export interface LazyRowsState {
    total: number;
    loadedRows: number;
    rowAt: (index: number) => CrawlUrlRow | null;
    ensureRange: (start: number, end: number) => void;
}
/**
 * Virtualized row loader with seamless live updates.
 *
 * Strategy: when sort/filter/category changes the cache is cleared and
 * the virtualizer re-fills through `ensureRange`. While a crawl is
 * running, a 1500ms timer re-queries only the currently visible chunks
 * and REPLACES them in place — no `.clear()`, no placeholder flicker.
 * Combined with `getItemKey: row.id` on the virtualizer, rows that still
 * exist keep their DOM nodes and only their cells re-render; rows that
 * have moved (because new higher-priority rows were inserted ahead of
 * them in the sort order) slide naturally as the virtualizer's total
 * count grows. The user sees a continuously-flowing, sorted table.
 */
export declare function useLazyUrlRows(opts: LazyRowsOpts): LazyRowsState;
//# sourceMappingURL=useLazyUrlRows.d.ts.map