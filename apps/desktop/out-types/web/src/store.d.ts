import { type CrawlConfig, type CrawlProgress, type CrawlSummary, type OverviewCounts, type UrlCategory } from '@freecrawl/shared-types';
export type TabKey = 'internal' | 'external' | 'response-codes' | 'url' | 'page-titles' | 'meta-description' | 'h1' | 'h2' | 'content' | 'images' | 'canonicals' | 'directives' | 'redirects' | 'links' | 'broken-links';
export declare const TAB_ORDER: {
    key: TabKey;
    label: string;
}[];
interface AppState {
    config: CrawlConfig;
    progress: CrawlProgress | null;
    summary: CrawlSummary | null;
    overview: OverviewCounts | null;
    activeTab: TabKey;
    activeCategory: UrlCategory;
    error: string | null;
    selectedUrlId: number | null;
    /** Multi-row selection in the main URLs table. Used by sub-tab views
     * (Inlinks / Outlinks / Images / Resources) to aggregate data across
     * every selected row instead of just the primary `selectedUrlId`. When
     * the user has only one row selected this mirrors `[selectedUrlId]`. */
    selectedUrlIds: number[];
    sidebarOpen: boolean;
    detailPanelOpen: boolean;
    settingsOpen: boolean;
    recentUrls: string[];
    dataVersion: number;
    setConfig: (patch: Partial<CrawlConfig>) => void;
    setProgress: (p: CrawlProgress) => void;
    setSummary: (s: CrawlSummary) => void;
    setOverview: (o: OverviewCounts) => void;
    setActiveTab: (t: TabKey) => void;
    setActiveCategory: (c: UrlCategory) => void;
    navigateToCategory: (c: UrlCategory) => void;
    setError: (e: string | null) => void;
    setSelectedUrlId: (id: number | null) => void;
    setSelectedUrlIds: (ids: number[]) => void;
    toggleSidebar: () => void;
    toggleDetailPanel: () => void;
    setSettingsOpen: (open: boolean) => void;
    addRecentUrl: (url: string) => void;
    bumpDataVersion: () => void;
    reset: () => void;
}
export declare const useAppStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AppState>>;
export {};
//# sourceMappingURL=store.d.ts.map