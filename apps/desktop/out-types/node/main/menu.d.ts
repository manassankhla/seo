import { Menu } from 'electron';
export interface AppMenuHandlers {
    onOpenLogs: () => void;
    /** Open an existing `.seoproject` file via dialog. */
    onOpenProject: () => void;
    /** Open a recent project by its absolute path. */
    onOpenRecent: (path: string) => void;
    /** Clear the recent-projects pref. */
    onClearRecent: () => void;
    /** Recently-opened/saved project paths, most recent first. May be empty. */
    recentProjects: readonly string[];
    /** Re-enable any "Don't show again" diagnostic dialogs the user dismissed. */
    onResetDiagnosticDialogs: () => void;
    /** Reveal the on-disk logs directory in the OS file manager. */
    onOpenLogsFolder: () => void;
}
export declare function buildAppMenu(handlers: AppMenuHandlers): Menu;
//# sourceMappingURL=menu.d.ts.map