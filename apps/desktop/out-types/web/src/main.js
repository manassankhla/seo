import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { LogsView } from './LogsView.js';
import './styles.css';
import './web-api.js'; // Inject the web API for browser testing
// The Logs popup window loads the same renderer bundle with `?logs=1` —
// we branch at the entry point so only the LogsView component mounts
// there (skipping the heavy main App, its stores, and IPC subscriptions).
const isLogsWindow = typeof window !== 'undefined' && /[?&]logs=1\b/.test(window.location.search);
const root = document.getElementById('root');
if (root) {
    createRoot(root).render(_jsx(React.StrictMode, { children: isLogsWindow ? _jsx(LogsView, {}) : _jsx(App, {}) }));
}
//# sourceMappingURL=main.js.map