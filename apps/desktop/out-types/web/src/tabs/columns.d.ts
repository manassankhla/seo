import type { CrawlUrlRow } from '@freecrawl/shared-types';
import type { TabKey } from '../store.js';
export interface ColumnSpec {
    /**
     * Unique UI id for this column (React key, width storage, resize). Defaults
     * to `key`, but two specs can share the same data `key` — e.g. Indexability
     * and Indexability Status both read `indexability` but must render as
     * separate columns with their own widths.
     */
    id?: string;
    key: keyof CrawlUrlRow;
    header: string;
    size: number;
    align?: 'left' | 'right';
    kind?: 'status' | 'mono' | 'number' | 'indexability' | 'indexability-status' | 'text';
    /** Tooltip description shown next to the header (info icon). */
    info?: string;
    /** Concrete example/value rendered under "Example" in the header tooltip. */
    example?: string;
}
export declare function columnId(c: ColumnSpec): string;
export declare const COLUMN_SPECS: Record<TabKey, ColumnSpec[]>;
//# sourceMappingURL=columns.d.ts.map