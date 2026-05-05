import { existsSync } from 'node:fs';
import type { LogEntry, LogLevel } from '@freecrawl/shared-types';
export declare function initFileLogging(baseDir: string): void;
export declare function getLogsDirectory(): string | null;
export declare function getCurrentLogFile(): string | null;
export declare function flushFileLogging(): void;
export declare function log(level: LogLevel, source: string, message: string, extra?: unknown): LogEntry;
export declare function getAll(): LogEntry[];
export declare function clearAll(): void;
export declare function subscribe(fn: (entry: LogEntry) => void): () => void;
/**
 * Intercept console.* and process-level crash signals so every diagnostic
 * that would normally vanish into stdout ends up in the in-app log window.
 * Safe to call multiple times (guarded by module-local flag).
 */
export declare function installGlobalHooks(): void;
export { existsSync };
//# sourceMappingURL=logger.d.ts.map