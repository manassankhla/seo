import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
/**
 * Logs are persisted to disk in addition to the in-memory ring buffer.
 * The buffer exists for live UI streaming; the disk file survives app
 * restarts / crashes and lets users send a real log to support without
 * worrying about the 500-line ring being overwritten.
 *
 * Tunables here:
 *   MAX_BUFFER_ENTRIES — UI ring buffer size (kept small now that disk
 *                        is the source of truth)
 *   MAX_FILE_BYTES     — single log file size before rotation
 *   MAX_RETAINED_FILES — how many old log files to keep before pruning
 */
const MAX_BUFFER_ENTRIES = 500;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_RETAINED_FILES = 10;
const buffer = [];
let seq = 0;
const subscribers = new Set();
let hooksInstalled = false;
let logsDir = null;
let currentLogPath = null;
let stream = null;
let bytesWritten = 0;
export function initFileLogging(baseDir) {
    if (logsDir)
        return;
    logsDir = join(baseDir, 'logs');
    try {
        mkdirSync(logsDir, { recursive: true });
    }
    catch {
        // If we can't create the dir we keep going with buffer-only — the app
        // must not refuse to start because the log folder is unavailable.
        logsDir = null;
        return;
    }
    pruneOldFiles();
    rotateIfNeeded(true);
}
export function getLogsDirectory() {
    return logsDir;
}
export function getCurrentLogFile() {
    return currentLogPath;
}
export function flushFileLogging() {
    if (stream) {
        try {
            stream.end();
        }
        catch {
            /* ignore */
        }
        stream = null;
    }
}
function rotateIfNeeded(forceNew) {
    if (!logsDir)
        return;
    if (!forceNew && stream && bytesWritten < MAX_FILE_BYTES)
        return;
    if (stream) {
        try {
            stream.end();
        }
        catch {
            /* ignore */
        }
        stream = null;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    currentLogPath = join(logsDir, `freecrawl-${stamp}.log`);
    try {
        stream = createWriteStream(currentLogPath, { flags: 'a' });
        stream.on('error', () => {
            // Disk write failures must not break the app; drop the stream and
            // let subsequent writes silently no-op until the next rotate.
            stream = null;
        });
        bytesWritten = 0;
    }
    catch {
        stream = null;
    }
}
function pruneOldFiles() {
    if (!logsDir)
        return;
    try {
        const entries = readdirSync(logsDir)
            .filter((n) => n.startsWith('freecrawl-') && n.endsWith('.log'))
            .map((n) => {
            const p = join(logsDir, n);
            let mtimeMs = 0;
            try {
                mtimeMs = statSync(p).mtimeMs;
            }
            catch {
                /* ignore */
            }
            return { path: p, mtimeMs };
        })
            .sort((a, b) => b.mtimeMs - a.mtimeMs);
        for (let i = MAX_RETAINED_FILES; i < entries.length; i++) {
            try {
                unlinkSync(entries[i].path);
            }
            catch {
                /* ignore — pruning is best effort */
            }
        }
    }
    catch {
        /* ignore */
    }
}
function writeToDisk(entry) {
    if (!stream)
        return;
    // Plain-text line: ISO ts | LEVEL | source | message — easy to grep,
    // easy to send to support, no JSON overhead.
    const line = `${entry.ts}  ${entry.level.toUpperCase().padEnd(5)} [${entry.source}] ${entry.message}\n`;
    try {
        stream.write(line);
        bytesWritten += Buffer.byteLength(line, 'utf8');
        if (bytesWritten >= MAX_FILE_BYTES) {
            rotateIfNeeded(true);
        }
    }
    catch {
        /* ignore — disk failure must not break the app */
    }
}
export function log(level, source, message, extra) {
    const msg = extra !== undefined ? `${message} ${safeStringify(extra)}` : message;
    const entry = {
        id: ++seq,
        ts: new Date().toISOString(),
        level,
        source,
        message: msg,
    };
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER_ENTRIES)
        buffer.shift();
    writeToDisk(entry);
    for (const fn of subscribers) {
        try {
            fn(entry);
        }
        catch {
            // Never let a misbehaving subscriber break the logger.
        }
    }
    return entry;
}
export function getAll() {
    return buffer.slice();
}
export function clearAll() {
    buffer.length = 0;
    // Disk-side: rotate to a fresh file so "Clear" produces a clean tail
    // for the user's next session, but past files are kept (pruning still
    // bounded by MAX_RETAINED_FILES).
    rotateIfNeeded(true);
}
export function subscribe(fn) {
    subscribers.add(fn);
    return () => {
        subscribers.delete(fn);
    };
}
/**
 * Patterns that match known-benign Node warnings we've explicitly opted
 * into — logging them at ERROR would be misleading since they aren't
 * bugs. The node:sqlite case is acknowledged in CLAUDE.md as expected
 * for this stack.
 */
const BENIGN_WARNING_PATTERNS = [
    /ExperimentalWarning:\s*SQLite/i,
];
function isBenignWarning(text) {
    return BENIGN_WARNING_PATTERNS.some((re) => re.test(text));
}
/**
 * Intercept console.* and process-level crash signals so every diagnostic
 * that would normally vanish into stdout ends up in the in-app log window.
 * Safe to call multiple times (guarded by module-local flag).
 */
export function installGlobalHooks() {
    if (hooksInstalled)
        return;
    hooksInstalled = true;
    const origLog = console.log.bind(console);
    const origInfo = console.info.bind(console);
    const origWarn = console.warn.bind(console);
    const origErr = console.error.bind(console);
    console.log = (...args) => {
        log('info', 'console', joinArgs(args));
        origLog(...args);
    };
    console.info = (...args) => {
        log('info', 'console', joinArgs(args));
        origInfo(...args);
    };
    console.warn = (...args) => {
        const text = joinArgs(args);
        if (!isBenignWarning(text))
            log('warn', 'console', text);
        origWarn(...args);
    };
    console.error = (...args) => {
        const text = joinArgs(args);
        // Node's process.emitWarning output can surface on stderr-routed
        // console.error in some Electron builds. Those aren't real errors —
        // downgrade (or drop, if benign) to avoid scaring users.
        if (isBenignWarning(text)) {
            origErr(...args);
            return;
        }
        const level = /\(node:\d+\)\s+\w*Warning:/.test(text) ? 'warn' : 'error';
        log(level, 'console', text);
        origErr(...args);
    };
    // Taking a listener on 'warning' disables Node's default stderr printer,
    // so from here on every process.emitWarning() flows through us and we
    // control the level + suppression centrally.
    process.on('warning', (warning) => {
        const name = warning.name || 'Warning';
        const text = `${name}: ${warning.message}`;
        if (isBenignWarning(text))
            return;
        log('warn', 'node', warning.stack ? warning.stack : text);
    });
    process.on('uncaughtException', (err) => {
        log('error', 'uncaughtException', err instanceof Error ? (err.stack ?? err.message) : String(err));
    });
    process.on('unhandledRejection', (reason) => {
        log('error', 'unhandledRejection', reason instanceof Error ? (reason.stack ?? reason.message) : String(reason));
    });
}
function joinArgs(args) {
    return args
        .map((a) => (typeof a === 'string' ? a : a instanceof Error ? (a.stack ?? a.message) : safeStringify(a)))
        .join(' ');
}
function safeStringify(v) {
    if (typeof v === 'string')
        return v;
    if (v instanceof Error)
        return v.stack ?? v.message;
    try {
        return JSON.stringify(v);
    }
    catch {
        return String(v);
    }
}
// Avoid an unused-import error when existsSync isn't called elsewhere.
// We re-export it for the (rare) future need to test for a logs dir
// outside this module.
export { existsSync };
//# sourceMappingURL=logger.js.map