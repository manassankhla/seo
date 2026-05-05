import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useAppStore } from '../store.js';
const SUB_TABS = [
    { key: 'url-details', label: 'URL Details' },
    { key: 'outline', label: 'Outline' },
    { key: 'inlinks', label: 'Inlinks' },
    { key: 'outlinks', label: 'Outlinks' },
    { key: 'images', label: 'Images' },
    { key: 'resources', label: 'Resources' },
    { key: 'extracted-data', label: 'Extracted Data' },
    { key: 'serp-snippet', label: 'SERP Snippet' },
    { key: 'http-headers', label: 'HTTP Headers' },
    { key: 'cookies', label: 'Cookies' },
    { key: 'structured-data', label: 'Structured Data' },
    { key: 'view-source', label: 'View Source' },
];
// Maximum number of URLs we aggregate over in one go. Anything larger is
// treated as a "too many" hint so the user can narrow the selection
// before we burn N parallel reader-pool requests on it.
const MULTI_DETAIL_LIMIT = 50;
// Tabs that pivot on a single page (HTTP response, snippet, source, etc.)
// — when the user has multi-selected rows we keep these scoped to the
// primary URL and surface a banner so the scope is clear.
const SINGLE_URL_ONLY_TABS = new Set([
    'url-details',
    'outline',
    'extracted-data',
    'serp-snippet',
    'http-headers',
    'cookies',
    'structured-data',
    'view-source',
]);
export function BottomDetailPanel() {
    const selectedUrlId = useAppStore((s) => s.selectedUrlId);
    const selectedUrlIds = useAppStore((s) => s.selectedUrlIds);
    const [detail, setDetail] = useState(null);
    const [details, setDetails] = useState([]);
    const [loading, setLoading] = useState(false);
    const [subTab, setSubTab] = useState('url-details');
    // Effective scope: if the user has 2+ rows selected we aggregate; one
    // row (or none) keeps the existing single-URL behaviour intact.
    const effectiveIds = useMemo(() => {
        if (selectedUrlIds.length > 1)
            return selectedUrlIds;
        if (selectedUrlId !== null)
            return [selectedUrlId];
        return [];
    }, [selectedUrlId, selectedUrlIds]);
    const isMulti = effectiveIds.length > 1;
    const truncated = isMulti && effectiveIds.length > MULTI_DETAIL_LIMIT;
    const fetchIds = useMemo(() => (truncated ? effectiveIds.slice(0, MULTI_DETAIL_LIMIT) : effectiveIds), [effectiveIds, truncated]);
    // Stable cache key so we don't re-fetch on every render of the same set.
    const fetchKey = fetchIds.join(',');
    useEffect(() => {
        if (fetchIds.length === 0) {
            setDetail(null);
            setDetails([]);
            return;
        }
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                if (fetchIds.length === 1) {
                    const d = await window.freecrawl.urlDetailGet({ id: fetchIds[0] });
                    if (!cancelled) {
                        setDetail(d);
                        setDetails(d ? [d] : []);
                    }
                }
                else {
                    const results = await Promise.all(fetchIds.map((id) => window.freecrawl.urlDetailGet({ id })));
                    if (!cancelled) {
                        const list = results.filter((r) => r !== null);
                        setDetails(list);
                        // The "primary" detail is the one matching `selectedUrlId`
                        // (last clicked); fall back to the first if it's missing.
                        const primary = list.find((r) => r.row.id === selectedUrlId) ?? list[0] ?? null;
                        setDetail(primary);
                    }
                }
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
        // selectedUrlId is intentionally excluded from deps — it only steers
        // which entry of `details` becomes "primary" and we resolve that
        // inside the load() body. fetchKey covers multi-set changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchKey]);
    // When only the primary id changes (e.g. user clicked a different cell
    // within the same multi-selection set), re-pick the primary detail
    // without re-fetching the whole batch.
    useEffect(() => {
        if (!isMulti || details.length === 0)
            return;
        const primary = details.find((r) => r.row.id === selectedUrlId) ?? details[0] ?? null;
        setDetail(primary);
    }, [selectedUrlId, details, isMulti]);
    // Aggregated link rows: each detail's inlinks/outlinks already carry
    // their fromUrl / toUrl so concatenation is enough — the From / To
    // columns in the table naturally distinguish which page each row
    // belongs to.
    const aggregatedInlinks = useMemo(() => {
        if (details.length === 0)
            return [];
        const rows = [];
        for (const d of details) {
            for (const l of d.inlinks) {
                rows.push(buildLinkRow({
                    fromUrl: l.fromUrl,
                    toUrl: d.row.url,
                    toStatusCode: l.toStatusCode,
                    toSize: l.toSize,
                    type: l.type,
                    anchor: l.anchor,
                    altText: l.altText,
                    rel: l.rel,
                    target: l.target,
                    pathType: l.pathType,
                    linkPath: l.linkPath,
                    linkPosition: l.linkPosition,
                    linkOrigin: l.linkOrigin,
                }));
            }
        }
        return rows;
    }, [details]);
    const aggregatedOutlinks = useMemo(() => {
        if (details.length === 0)
            return [];
        const rows = [];
        for (const d of details) {
            for (const l of d.outlinks) {
                rows.push(buildLinkRow({
                    fromUrl: d.row.url,
                    toUrl: l.toUrl,
                    toStatusCode: l.toStatusCode,
                    toSize: l.toSize,
                    type: l.type,
                    anchor: l.anchor,
                    altText: l.altText,
                    rel: l.rel,
                    target: l.target,
                    pathType: l.pathType,
                    linkPath: l.linkPath,
                    linkPosition: l.linkPosition,
                    linkOrigin: l.linkOrigin,
                }));
            }
        }
        return rows;
    }, [details]);
    const aggregatedInlinksTotal = useMemo(() => details.reduce((n, d) => n + d.inlinksTotal, 0), [details]);
    const aggregatedOutlinksTotal = useMemo(() => details.reduce((n, d) => n + d.outlinksTotal, 0), [details]);
    // For Images / Resources we collect (urlId, row) pairs so the dedicated
    // multi-views can spread their fetches across the same set the user
    // picked in the main table.
    const multiPages = useMemo(() => details.map((d) => ({ id: d.row.id, row: d.row })), [details]);
    const inlinksCountLabel = isMulti ? aggregatedInlinksTotal : detail?.inlinksTotal;
    const outlinksCountLabel = isMulti ? aggregatedOutlinksTotal : detail?.outlinksTotal;
    const showSingleScopeBanner = isMulti && SINGLE_URL_ONLY_TABS.has(subTab);
    return (_jsxs("div", { className: "flex h-full flex-col bg-surface-950", children: [_jsxs("div", { className: "flex items-center border-b border-surface-800 bg-surface-900", children: [SUB_TABS.map((t) => (_jsxs("button", { disabled: t.disabled, className: clsx('tab', subTab === t.key && 'tab-active', t.disabled && 'cursor-not-allowed opacity-40'), onClick: () => !t.disabled && setSubTab(t.key), title: t.disabled ? 'Coming soon' : undefined, children: [t.label, t.key === 'inlinks' && inlinksCountLabel !== undefined && (_jsxs("span", { className: "ml-1 text-surface-500", children: ["(", inlinksCountLabel.toLocaleString(), ")"] })), t.key === 'outlinks' && outlinksCountLabel !== undefined && (_jsxs("span", { className: "ml-1 text-surface-500", children: ["(", outlinksCountLabel.toLocaleString(), ")"] }))] }, t.key))), isMulti && (_jsxs("div", { className: "ml-auto px-3 text-[10.5px] text-surface-400", children: [_jsx("span", { className: "font-mono text-accent-300", children: effectiveIds.length.toLocaleString() }), ' ', "URLs selected", truncated && (_jsxs("span", { className: "ml-2 text-amber-400", children: ["\u00B7 aggregating first ", MULTI_DETAIL_LIMIT] }))] }))] }), showSingleScopeBanner && detail && (_jsxs("div", { className: "shrink-0 border-b border-surface-800 bg-surface-900/40 px-3 py-1 text-[10.5px] text-surface-400", children: ["This tab is per-page \u2014 showing data for", ' ', _jsx("span", { className: "font-mono text-surface-200", children: detail.row.url }), ' ', "(primary URL of the selection)."] })), _jsxs("div", { className: "flex-1 overflow-auto", children: [effectiveIds.length === 0 && (_jsx("div", { className: "flex h-full items-center justify-center text-xs text-surface-500", children: "Select a URL from the table to see details." })), effectiveIds.length > 0 && !detail && loading && (_jsx("div", { className: "p-4 text-xs text-surface-500", children: "Loading\u2026" })), detail && subTab === 'url-details' && _jsx(NameValueView, { row: detail.row }), subTab === 'inlinks' &&
                        (isMulti ? (details.length > 0 && (_jsx(LinksView, { tableId: "inlinks-multi", selectedUrlId: detail?.row.id ?? null, total: aggregatedInlinksTotal, shown: aggregatedInlinks.length, columns: LINK_COLUMNS, rows: aggregatedInlinks }))) : (detail && (_jsx(LinksView, { tableId: "inlinks", selectedUrlId: detail.row.id, total: detail.inlinksTotal, shown: detail.inlinks.length, columns: LINK_COLUMNS, rows: detail.inlinks.map((l) => buildLinkRow({
                                fromUrl: l.fromUrl,
                                toUrl: detail.row.url,
                                toStatusCode: l.toStatusCode,
                                toSize: l.toSize,
                                type: l.type,
                                anchor: l.anchor,
                                altText: l.altText,
                                rel: l.rel,
                                target: l.target,
                                pathType: l.pathType,
                                linkPath: l.linkPath,
                                linkPosition: l.linkPosition,
                                linkOrigin: l.linkOrigin,
                            })) })))), subTab === 'outlinks' &&
                        (isMulti ? (details.length > 0 && (_jsx(LinksView, { tableId: "outlinks-multi", selectedUrlId: detail?.row.id ?? null, total: aggregatedOutlinksTotal, shown: aggregatedOutlinks.length, columns: LINK_COLUMNS, rows: aggregatedOutlinks }))) : (detail && (_jsx(LinksView, { tableId: "outlinks", selectedUrlId: detail.row.id, total: detail.outlinksTotal, shown: detail.outlinks.length, columns: LINK_COLUMNS, rows: detail.outlinks.map((l) => buildLinkRow({
                                fromUrl: detail.row.url,
                                toUrl: l.toUrl,
                                toStatusCode: l.toStatusCode,
                                toSize: l.toSize,
                                type: l.type,
                                anchor: l.anchor,
                                altText: l.altText,
                                rel: l.rel,
                                target: l.target,
                                pathType: l.pathType,
                                linkPath: l.linkPath,
                                linkPosition: l.linkPosition,
                                linkOrigin: l.linkOrigin,
                            })) })))), detail && subTab === 'outline' && _jsx(OutlineView, { row: detail.row }), subTab === 'images' &&
                        (isMulti ? (_jsx(MultiImagesView, { pages: multiPages })) : (detail && _jsx(ImagesView, { urlId: detail.row.id, row: detail.row }))), subTab === 'resources' &&
                        (isMulti ? (_jsx(MultiResourcesView, { pages: multiPages })) : (detail && _jsx(ResourcesView, { urlId: detail.row.id, row: detail.row }))), detail && subTab === 'extracted-data' && (_jsx(ExtractedDataView, { row: detail.row })), detail && subTab === 'serp-snippet' && _jsx(SerpSnippet, { row: detail.row }), detail && subTab === 'http-headers' && _jsx(HttpHeadersView, { headers: detail.headers }), detail && subTab === 'cookies' && (_jsx(CookiesView, { row: detail.row, headers: detail.headers })), detail && subTab === 'structured-data' && (_jsx(StructuredDataView, { urlId: detail.row.id, row: detail.row })), detail && subTab === 'view-source' && (_jsx(ViewSourceView, { urlId: detail.row.id, pageUrl: detail.row.url }))] })] }));
}
function ViewSourceView({ urlId, pageUrl, }) {
    const [src, setSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [wrap, setWrap] = useState(false);
    useEffect(() => {
        if (urlId === null) {
            setSrc(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void window.freecrawl
            .urlSourceGet({ id: urlId })
            .then((r) => {
            if (!cancelled)
                setSrc(r);
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [urlId]);
    if (loading && !src) {
        return _jsx("div", { className: "p-4 text-[11px] text-surface-500", children: "Loading source\u2026" });
    }
    if (!src || src.body === null) {
        return (_jsxs("div", { className: "p-4 text-[11px] text-surface-500", children: ["No HTML body stored for this URL.", _jsxs("div", { className: "mt-1 text-[10px] text-surface-600", children: ["View Source is only captured for HTML pages crawled with the", _jsx("span", { className: "font-mono", children: "storeBodySnapshots" }), " setting enabled."] })] }));
    }
    const body = src.body;
    const matches = search ? countMatches(body, search) : 0;
    function copy() {
        void navigator.clipboard.writeText(body);
    }
    function download() {
        const blob = new Blob([body], { type: 'text/html;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        let filename = 'page.html';
        try {
            const u = new URL(pageUrl);
            const seg = u.pathname.replace(/\/+$/, '').split('/').pop() || u.hostname;
            filename = `${(seg || 'page').replace(/[^a-z0-9._-]/gi, '_')}.html`;
        }
        catch {
            /* ignore */
        }
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5_000);
    }
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b border-surface-800 bg-surface-900/50 px-3 py-1.5 text-[11px]", children: [_jsxs("span", { className: "text-surface-500", children: [(src.bodyLength / 1024).toFixed(1), " KB", src.truncated && (_jsx("span", { className: "ml-1 rounded bg-amber-900/40 px-1.5 py-0.5 text-[9px] uppercase text-amber-300", children: "truncated" }))] }), src.capturedAt && (_jsxs("span", { className: "text-surface-600", children: ["\u00B7 captured ", src.capturedAt] })), _jsx("input", { type: "text", className: "ml-3 w-48 rounded border border-surface-700 bg-surface-950 px-2 py-0.5 text-[11px] text-surface-100 focus:border-blue-500 focus:outline-none", placeholder: "Search source\u2026", value: search, onChange: (e) => setSearch(e.target.value), spellCheck: false }), search && (_jsxs("span", { className: "text-surface-500", children: [matches, " match", matches === 1 ? '' : 'es'] })), _jsxs("label", { className: "flex items-center gap-1 text-surface-400", children: [_jsx("input", { type: "checkbox", checked: wrap, onChange: (e) => setWrap(e.target.checked), className: "h-3 w-3" }), "Wrap"] }), _jsxs("div", { className: "ml-auto flex gap-1.5", children: [_jsx("button", { className: "rounded border border-surface-700 px-2 py-0.5 text-[10px] hover:bg-surface-800", onClick: copy, children: "Copy" }), _jsx("button", { className: "rounded border border-surface-700 px-2 py-0.5 text-[10px] hover:bg-surface-800", onClick: download, children: "Download" })] })] }), _jsx("div", { className: "flex-1 overflow-auto bg-surface-950 p-3", children: _jsx("pre", { className: clsx('font-mono text-[10.5px] leading-[14px] text-surface-200', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'), children: search ? renderHighlighted(body, search) : body }) })] }));
}
function countMatches(haystack, needle) {
    if (!needle)
        return 0;
    const h = haystack.toLowerCase();
    const n = needle.toLowerCase();
    let count = 0;
    let pos = 0;
    while ((pos = h.indexOf(n, pos)) !== -1) {
        count++;
        pos += n.length;
    }
    return count;
}
function renderHighlighted(body, needle) {
    if (!needle)
        return body;
    const out = [];
    const lower = body.toLowerCase();
    const lowerNeedle = needle.toLowerCase();
    let pos = 0;
    // Cap at 5000 highlights so a runaway search term ("a") doesn't tank
    // the renderer with hundreds of thousands of <mark> nodes.
    const MAX_HITS = 5000;
    let hits = 0;
    while (pos < body.length && hits < MAX_HITS) {
        const idx = lower.indexOf(lowerNeedle, pos);
        if (idx === -1) {
            out.push(body.slice(pos));
            break;
        }
        if (idx > pos)
            out.push(body.slice(pos, idx));
        out.push(_jsx("mark", { className: "rounded bg-amber-500/40 text-amber-100", children: body.slice(idx, idx + needle.length) }, `m${idx}`));
        pos = idx + needle.length;
        hits++;
    }
    if (pos < body.length && hits >= MAX_HITS) {
        out.push(body.slice(pos));
    }
    return out;
}
function HttpHeadersView({ headers }) {
    if (headers.length === 0) {
        return (_jsx("div", { className: "p-4 text-[11px] text-surface-500", children: "No response headers captured for this URL." }));
    }
    return (_jsx("div", { className: "p-3", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "sticky top-0 bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "w-64 py-1 pr-3 text-left font-medium", children: "Header" }), _jsx("th", { className: "py-1 text-left font-medium", children: "Value" })] }) }), _jsx("tbody", { children: headers.map((h) => (_jsxs("tr", { className: "border-b border-surface-900 last:border-0", children: [_jsx("td", { className: "py-1.5 pr-3 align-top font-mono text-surface-400", children: h.name }), _jsx("td", { className: "break-all py-1.5 align-top font-mono text-surface-100", children: h.value })] }, h.name))) })] }) }));
}
function NameValueView({ row }) {
    // Server-side pixel-width is the source of truth (drives the issue
    // filters); fall back to the renderer estimate only when the column is
    // legitimately 0 because the title/desc is empty.
    const pixelWidthTitle = row.title && row.titlePixelWidth > 0
        ? row.titlePixelWidth
        : row.title
            ? measurePixelWidth(row.title, 15)
            : null;
    const pixelWidthDesc = row.metaDescription && row.metaPixelWidth > 0
        ? row.metaPixelWidth
        : row.metaDescription
            ? measurePixelWidth(row.metaDescription, 13)
            : null;
    // Lazy-load TLS cert info for HTTPS URLs only. The lookup is cheap
    // (single primary-key fetch on `host_certs`) but skipped entirely for
    // HTTP URLs so we don't pay an IPC round-trip on every selection.
    const [cert, setCert] = useState(null);
    useEffect(() => {
        if (!row.url.startsWith('https://')) {
            setCert(null);
            return;
        }
        let cancelled = false;
        void window.freecrawl
            .urlCertInfo({ id: row.id })
            .then((r) => {
            if (!cancelled)
                setCert(r);
        })
            .catch(() => {
            /* ignore — cert info is best-effort */
        });
        return () => {
            cancelled = true;
        };
    }, [row.id, row.url]);
    const certExpiryLabel = cert && cert.daysUntilExpiry !== null
        ? cert.daysUntilExpiry < 0
            ? `EXPIRED (${Math.abs(cert.daysUntilExpiry)} days ago)`
            : cert.daysUntilExpiry <= 30
                ? `Expires in ${cert.daysUntilExpiry} days (renew soon)`
                : `Expires in ${cert.daysUntilExpiry} days`
        : null;
    const fields = [
        ['Address', row.url],
        ['Status Code', row.statusCode],
        ['Status', row.statusText ?? (row.statusCode === null ? null : httpStatusText(row.statusCode))],
        ['Indexability', row.indexability],
        ['Indexability Reason', row.indexabilityReason],
        ['Content Type', row.contentType],
        ['Content Kind', row.contentKind],
        ['Size (Bytes)', row.contentLength],
        ['Response Time (ms)', row.responseTimeMs],
        ['TTFB (ms)', row.ttfbMs],
        ['HTTP Protocol', row.httpProtocol],
        ['Server', row.serverHeader],
        ['Query String Length', row.queryStringLength > 0 ? row.queryStringLength : null],
        [
            'Render-Blocking (head)',
            row.renderBlockingCount > 0 ? row.renderBlockingCount : null,
        ],
        ['Keep-Alive', row.keepAlive ? 'yes' : null],
        ['Title 1', row.title],
        ['Title 1 Length', row.titleLength],
        ['Title 1 Pixel Width', pixelWidthTitle],
        ['Meta Description 1', row.metaDescription],
        ['Meta Description 1 Length', row.metaDescriptionLength],
        ['Meta Description 1 Pixel Width', pixelWidthDesc],
        ['H1-1', row.h1],
        ['H1-1 Length', row.h1Length],
        ['H1 Count', row.h1Count],
        ['H2 Count', row.h2Count],
        ['H3 Count', row.h3Count > 0 ? row.h3Count : null],
        ['H4 Count', row.h4Count > 0 ? row.h4Count : null],
        ['H5 Count', row.h5Count > 0 ? row.h5Count : null],
        ['H6 Count', row.h6Count > 0 ? row.h6Count : null],
        ['Word Count', row.wordCount],
        ['Canonical Link Element 1', row.canonical],
        ['Canonical Count', row.canonicalCount > 1 ? row.canonicalCount : null],
        ['Canonical HTTP Header', row.canonicalHttp],
        ['Meta Robots 1', row.metaRobots],
        ['X-Robots-Tag 1', row.xRobotsTag],
        ['HTML Lang', row.lang],
        ['Viewport', row.viewport],
        ['OG Title', row.ogTitle],
        ['OG Description', row.ogDescription],
        ['OG Image', row.ogImage],
        ['Twitter Card', row.twitterCard],
        ['Twitter Title', row.twitterTitle],
        ['Twitter Description', row.twitterDescription],
        ['Twitter Image', row.twitterImage],
        ['Meta Keywords', row.metaKeywords],
        ['Meta Author', row.metaAuthor],
        ['Meta Generator', row.metaGenerator],
        ['Theme Color', row.themeColor],
        ['Charset', row.charset],
        ['Meta Refresh', row.metaRefresh],
        ['Meta Refresh URL', row.metaRefreshUrl],
        ['TLS Protocol', cert?.protocol ?? null],
        ['TLS Cert Issuer', cert?.issuer ?? null],
        ['TLS Cert Subject', cert?.subject ?? null],
        ['TLS Cert Signature Alg', cert?.signatureAlgorithm ?? null],
        ['TLS Cert Valid From', cert?.validFrom ?? null],
        ['TLS Cert Valid To', cert?.validTo ?? null],
        ['TLS Cert Status', certExpiryLabel],
        ['Strict-Transport-Security', row.hsts],
        ['X-Frame-Options', row.xFrameOptions],
        ['X-Content-Type-Options', row.xContentTypeOptions],
        ['Content-Security-Policy', row.csp],
        ['Referrer-Policy', row.referrerPolicy],
        ['Permissions-Policy', row.permissionsPolicy],
        ['Content-Encoding', row.contentEncoding],
        ['Analytics Tags', summarizeAnalyticsTrackers(row.analyticsTrackers)],
        ['Schema Types', row.schemaTypes],
        ['JSON-LD Blocks', row.schemaBlockCount],
        ['Invalid JSON-LD Blocks', row.schemaInvalidCount > 0 ? row.schemaInvalidCount : null],
        ['Microdata Items', row.microdataCount > 0 ? row.microdataCount : null],
        ['RDFa Attributes', row.rdfaCount > 0 ? row.rdfaCount : null],
        ['Insecure Form Actions', row.insecureFormActionCount > 0 ? row.insecureFormActionCount : null],
        ['Missing SRI (3rd-party)', row.missingSriCount > 0 ? row.missingSriCount : null],
        ['Cookies Set', row.cookiesCount > 0 ? row.cookiesCount : null],
        ['Cookies Missing Secure', row.cookiesInsecure > 0 ? row.cookiesInsecure : null],
        ['Cookies Missing HttpOnly', row.cookiesNoHttpOnly > 0 ? row.cookiesNoHttpOnly : null],
        ['Cookies Missing SameSite', row.cookiesNoSameSite > 0 ? row.cookiesNoSameSite : null],
        ['Pagination Next', row.paginationNext],
        ['Pagination Prev', row.paginationPrev],
        ['Hreflang Count', row.hreflangCount > 0 ? row.hreflangCount : null],
        ['Hreflangs', summarizeHreflangs(row.hreflangs)],
        ['AMP HTML', row.amphtml],
        ['Favicon', row.favicon],
        ['Apple Touch Icon', row.appleTouchIcon],
        ['Web Manifest', row.manifestUrl],
        ['RSS / Atom Feed', row.feedUrl],
        ['Title Tag Count', row.titleCount > 1 ? row.titleCount : null],
        ['Empty-Alt Images', row.imagesEmptyAlt > 0 ? row.imagesEmptyAlt : null],
        [
            'Lazy-Loaded Images',
            row.imagesCount > 0
                ? `${row.imagesLazy} / ${row.imagesCount} (${Math.round((row.imagesLazy / row.imagesCount) * 100)}%)`
                : null,
        ],
        ['Form Inputs', row.formInputCount > 0 ? row.formInputCount : null],
        [
            'Form Inputs Without Label',
            row.formInputUnlabeled > 0 ? row.formInputUnlabeled : null,
        ],
        ['Empty Anchor Links', row.emptyAnchorCount > 0 ? row.emptyAnchorCount : null],
        ['Mixed Content (subresources)', row.mixedContentCount > 0 ? row.mixedContentCount : null],
        [
            'Redirect Chain Length',
            row.redirectChainLength > 0 ? row.redirectChainLength : null,
        ],
        ['Redirect Final URL', row.redirectFinalUrl],
        ['Redirect Loop', row.redirectLoop ? 'YES' : null],
        ['Folder Depth', row.folderDepth],
        ['Query Param Count', row.queryParamCount > 0 ? row.queryParamCount : null],
        ...customSearchRows(row.customSearchHits),
        ...extractionRows(row.extractionResults),
        ['Crawl Depth', row.depth],
        ['Inlinks', row.inlinks],
        ['Outlinks', row.outlinks],
        ['Redirect URL', row.redirectTarget],
        ['Last Crawled', row.crawledAt],
    ];
    return (_jsx("div", { className: "p-3", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "sticky top-0 bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "w-64 py-1 pr-3 text-left font-medium", children: "Name" }), _jsx("th", { className: "py-1 text-left font-medium", children: "Value" })] }) }), _jsx("tbody", { children: fields.map(([label, value]) => (_jsxs("tr", { className: "border-b border-surface-900 last:border-0", children: [_jsx("td", { className: "py-1.5 pr-3 align-top text-surface-400", children: label }), _jsx("td", { className: "break-all py-1.5 font-mono text-surface-100", title: value !== null && value !== undefined ? String(value) : '', children: value === null || value === undefined || value === '' ? (_jsx("span", { className: "text-surface-700", children: "\u2014" })) : (String(value)) })] }, label))) })] }) }));
}
/** Canonical 16-column schema for Inlinks / Outlinks (Screaming Frog parity). */
const LINK_COLUMNS = [
    { id: 'type', header: 'Type', width: 90 },
    { id: 'from', header: 'From', width: 320 },
    { id: 'to', header: 'To', width: 320 },
    { id: 'anchor', header: 'Anchor Text', width: 220 },
    { id: 'alt-text', header: 'Alt Text', width: 180 },
    { id: 'follow', header: 'Follow', width: 70 },
    { id: 'target', header: 'Target', width: 90 },
    { id: 'rel', header: 'Rel', width: 110 },
    { id: 'status-code', header: 'Status Code', width: 90 },
    { id: 'status', header: 'Status', width: 110 },
    { id: 'path-type', header: 'Path Type', width: 130 },
    { id: 'link-path', header: 'Link Path', width: 200 },
    { id: 'link-position', header: 'Link Position', width: 110 },
    { id: 'link-origin', header: 'Link Origin', width: 100 },
    { id: 'size', header: 'Size', width: 90 },
    { id: 'transferred', header: 'Transferred', width: 100 },
];
/** Collapse a full link record into the 16 column cells shown in the UI. */
function buildLinkRow(r) {
    const follow = r.rel?.toLowerCase().includes('nofollow') ? 'False' : 'True';
    const size = formatSize(r.toSize);
    return [
        capitalise(r.type),
        r.fromUrl,
        r.toUrl,
        r.anchor ?? '',
        r.altText ?? '',
        follow,
        r.target ?? '',
        r.rel ?? '',
        r.toStatusCode?.toString() ?? '',
        r.toStatusCode !== null && r.toStatusCode !== undefined
            ? httpStatusText(r.toStatusCode)
            : '',
        r.pathType ? capitalisePathType(r.pathType) : '',
        r.linkPath ?? '',
        r.linkPosition ? capitalise(r.linkPosition) : '',
        r.linkOrigin.toUpperCase(),
        size,
        // Transferred bytes aren't tracked separately yet (we store the
        // decoded body length); mirror Size so the column is meaningful.
        size,
    ];
}
function capitalise(s) {
    return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
function capitalisePathType(t) {
    switch (t) {
        case 'absolute':
            return 'Absolute';
        case 'root-relative':
            return 'Root-Relative';
        case 'path-relative':
            return 'Path-Relative';
        case 'protocol-relative':
            return 'Protocol-Relative';
    }
}
function formatSize(bytes) {
    if (bytes === null || bytes === undefined)
        return '';
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
const LINKS_MIN_COL_WIDTH = 60;
const LINKS_HEADER_HEIGHT = 24;
const LINKS_ROW_HEIGHT = 26;
const LINKS_PREFS_PREFIX = 'link-col-widths:';
function LinksView({ tableId, selectedUrlId, total, shown, columns, rows, }) {
    const prefsKey = LINKS_PREFS_PREFIX + tableId;
    const [colWidths, setColWidths] = useState(() => {
        const v = window.freecrawl.prefsGet(prefsKey);
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            return v;
        }
        return {};
    });
    // Selected cells keyed "rowIdx:colIdx" so the same cell set survives
    // across renders even when the rows array is reconstructed by the parent.
    const [selected, setSelected] = useState(new Set());
    const anchor = useRef(null);
    // Drag-selection state — null when not dragging. `base` holds the
    // pre-drag snapshot so Ctrl+drag can union drag range with prior picks.
    const dragRef = useRef(null);
    // Right-click context-menu position. Null = menu hidden. The menu is a
    // small in-page popover (not the native Electron menu) so we can wire
    // it up without round-tripping through IPC for every click.
    const [menu, setMenu] = useState(null);
    const rootRef = useRef(null);
    // `selected` and `rows` change every render; keep the latest in refs
    // so the document-level keydown listener can read them without being
    // re-attached on every state change.
    const selectedRef = useRef(selected);
    const rowsRef = useRef(rows);
    selectedRef.current = selected;
    rowsRef.current = rows;
    // Reset selection when the detail target or table switches — otherwise
    // stale cells from a previous URL would remain highlighted.
    useEffect(() => {
        setSelected(new Set());
        setMenu(null);
        anchor.current = null;
        dragRef.current = null;
    }, [selectedUrlId, tableId]);
    // Clearing the drag on any mouseup guarantees that releasing the button
    // outside the table doesn't leave a "sticky" drag that extends on the
    // next mouseenter.
    useEffect(() => {
        const onUp = () => {
            dragRef.current = null;
        };
        document.addEventListener('mouseup', onUp);
        return () => document.removeEventListener('mouseup', onUp);
    }, []);
    // Ctrl/Cmd+C: copy the current cell selection to the clipboard as TSV.
    // Listening at the document level means the user doesn't have to focus
    // the table first — pressing the shortcut while there's at least one
    // selected cell in this LinksView is enough.
    useEffect(() => {
        const onKey = (e) => {
            if (!(e.ctrlKey || e.metaKey))
                return;
            if (e.key !== 'c' && e.key !== 'C')
                return;
            const sel = selectedRef.current;
            if (sel.size === 0)
                return;
            // Don't override copy when the user is in an input/textarea — they
            // probably want the input's selection, not ours.
            const target = e.target;
            const tag = target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
                return;
            }
            e.preventDefault();
            void copyCellsToClipboard(sel, rowsRef.current);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);
    // Close the context menu on outside click / scroll / escape so it
    // doesn't get left dangling when the user clicks elsewhere.
    useEffect(() => {
        if (!menu)
            return;
        const close = () => setMenu(null);
        const onKey = (e) => {
            if (e.key === 'Escape')
                setMenu(null);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('scroll', close, true);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('scroll', close, true);
            document.removeEventListener('keydown', onKey);
        };
    }, [menu]);
    const getWidth = (c) => colWidths[c.id] ?? c.width;
    const totalWidth = columns.reduce((n, c) => n + getWidth(c), 0);
    const writeWidths = (next) => {
        if (Object.keys(next).length === 0) {
            window.freecrawl.prefsDelete(prefsKey);
        }
        else {
            window.freecrawl.prefsSet(prefsKey, next);
        }
    };
    const startResize = (id, startWidth, clientX) => {
        const startX = clientX;
        const onMove = (ev) => {
            const delta = ev.clientX - startX;
            const next = Math.max(LINKS_MIN_COL_WIDTH, Math.round(startWidth + delta));
            setColWidths((prev) => {
                const updated = { ...prev, [id]: next };
                writeWidths(updated);
                return updated;
            });
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    const resetColumn = (id) => {
        setColWidths((prev) => {
            const next = { ...prev };
            delete next[id];
            writeWidths(next);
            return next;
        });
    };
    const cellKey = (r, c) => `${r}:${c}`;
    const handleCellClick = (r, c, e) => {
        // Shift+Click extends a vertical range within the anchor column. Users
        // expect Excel-like behaviour; rectangular multi-column ranges can come
        // later.
        if (e.shiftKey && anchor.current) {
            const a = anchor.current;
            const next = new Set(selected);
            if (a.c === c) {
                const [lo, hi] = a.r < r ? [a.r, r] : [r, a.r];
                for (let i = lo; i <= hi; i++)
                    next.add(cellKey(i, c));
            }
            else {
                next.add(cellKey(r, c));
            }
            setSelected(next);
            return;
        }
        // Ctrl/Cmd+Click: toggle the single cell in the current selection.
        if (e.ctrlKey || e.metaKey) {
            const next = new Set(selected);
            const k = cellKey(r, c);
            if (next.has(k))
                next.delete(k);
            else
                next.add(k);
            setSelected(next);
            anchor.current = { r, c };
            return;
        }
        // Plain click: single-cell. Clicking the only selected cell again
        // clears the selection (matches spreadsheet behaviour).
        const k = cellKey(r, c);
        if (selected.size === 1 && selected.has(k)) {
            setSelected(new Set());
            anchor.current = null;
            return;
        }
        setSelected(new Set([k]));
        anchor.current = { r, c };
    };
    const handleHeaderClick = (c, e) => {
        const keys = rows.map((_, r) => cellKey(r, c));
        if (e.ctrlKey || e.metaKey) {
            const next = new Set(selected);
            const allSelected = keys.every((k) => next.has(k));
            if (allSelected) {
                for (const k of keys)
                    next.delete(k);
            }
            else {
                for (const k of keys)
                    next.add(k);
            }
            setSelected(next);
            return;
        }
        setSelected(new Set(keys));
        anchor.current = rows.length > 0 ? { r: 0, c } : null;
    };
    // ──────── Drag selection ────────
    const applyCellDrag = (toR, toC) => {
        const d = dragRef.current;
        if (!d || d.kind !== 'cell')
            return;
        d.r = toR;
        d.c = toC;
        const loR = Math.min(d.aR, toR);
        const hiR = Math.max(d.aR, toR);
        const loC = Math.min(d.aC, toC);
        const hiC = Math.max(d.aC, toC);
        const next = new Set(d.base);
        for (let r = loR; r <= hiR; r++) {
            for (let c = loC; c <= hiC; c++) {
                next.add(cellKey(r, c));
            }
        }
        setSelected(next);
    };
    const applyColumnDrag = (toC) => {
        const d = dragRef.current;
        if (!d || d.kind !== 'column')
            return;
        d.c = toC;
        const loC = Math.min(d.aC, toC);
        const hiC = Math.max(d.aC, toC);
        const next = new Set(d.base);
        for (let c = loC; c <= hiC; c++) {
            for (let r = 0; r < rows.length; r++) {
                next.add(cellKey(r, c));
            }
        }
        setSelected(next);
    };
    const beginCellDrag = (r, c, e) => {
        if (e.button !== 0)
            return;
        if (e.shiftKey) {
            handleCellClick(r, c, e);
            return;
        }
        e.preventDefault();
        const additive = e.ctrlKey || e.metaKey;
        dragRef.current = {
            kind: 'cell',
            aR: r,
            aC: c,
            r,
            c,
            additive,
            base: additive ? new Set(selected) : new Set(),
        };
        anchor.current = { r, c };
        applyCellDrag(r, c);
    };
    const beginColumnDrag = (c, e) => {
        if (e.button !== 0)
            return;
        if (e.shiftKey) {
            handleHeaderClick(c, e);
            return;
        }
        e.preventDefault();
        const additive = e.ctrlKey || e.metaKey;
        dragRef.current = {
            kind: 'column',
            aC: c,
            c,
            additive,
            base: additive ? new Set(selected) : new Set(),
        };
        anchor.current = rows.length > 0 ? { r: 0, c } : null;
        applyColumnDrag(c);
    };
    const menuClickedCell = menu !== null ? rows[menu.row]?.[menu.col] ?? '' : '';
    const menuClickedIsUrl = isUrlLike(menuClickedCell);
    return (_jsxs("div", { ref: rootRef, className: "relative flex h-full select-none flex-col", children: [_jsxs("div", { className: "shrink-0 px-3 pt-2 text-[11px] text-surface-500", children: ["Showing ", _jsx("span", { className: "font-mono text-surface-200", children: shown.toLocaleString() }), " of", ' ', _jsx("span", { className: "font-mono text-surface-200", children: total.toLocaleString() })] }), rows.length === 0 ? (_jsx("div", { className: "py-8 text-center text-xs text-surface-500", children: "No links." })) : (_jsx("div", { className: "mt-2 flex-1 overflow-auto", children: _jsxs("div", { style: { minWidth: totalWidth, width: '100%' }, children: [_jsxs("div", { className: "sticky top-0 z-10 flex bg-surface-900 text-[11px]", style: {
                                minWidth: totalWidth,
                                width: '100%',
                                height: LINKS_HEADER_HEIGHT,
                            }, children: [columns.map((c, ci) => {
                                    const w = getWidth(c);
                                    return (_jsxs("div", { className: "relative flex cursor-pointer items-center border-b border-r border-surface-800 pl-2 pr-3 font-medium text-surface-400 hover:text-surface-100", style: { width: w, minWidth: w, flex: `0 0 ${w}px` }, onMouseDown: (e) => beginColumnDrag(ci, e), onMouseEnter: () => {
                                            if (dragRef.current?.kind === 'column')
                                                applyColumnDrag(ci);
                                        }, title: "Click to select column \u00B7 drag across headers to select multiple \u00B7 drag right edge to resize", children: [_jsx("span", { className: "truncate", children: c.header }), _jsx("div", { className: "absolute -right-1 top-0 bottom-0 z-20 w-2 cursor-col-resize hover:bg-accent-500/40", onMouseDown: (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    startResize(c.id, w, e.clientX);
                                                }, onDoubleClick: (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    resetColumn(c.id);
                                                }, onClick: (e) => e.stopPropagation(), title: "Drag to resize \u00B7 double-click to reset" })] }, c.id));
                                }), _jsx("div", { className: "flex-1 border-b border-surface-800" })] }), rows.map((r, ri) => (_jsxs("div", { className: "flex border-b border-surface-900 text-[11px]", style: {
                                minWidth: totalWidth,
                                width: '100%',
                                height: LINKS_ROW_HEIGHT,
                            }, children: [r.map((cell, ci) => {
                                    const col = columns[ci];
                                    if (!col)
                                        return null;
                                    const w = getWidth(col);
                                    const isSel = selected.has(cellKey(ri, ci));
                                    return (_jsx("div", { className: clsx('flex cursor-cell items-center overflow-hidden border-r border-surface-900 px-2', isSel
                                            ? 'bg-accent-500/25 text-surface-50'
                                            : 'text-surface-300 hover:bg-surface-900/60', ci === 0 && !isSel && 'font-mono text-surface-100', ci === 0 && isSel && 'font-mono'), style: { width: w, minWidth: w, flex: `0 0 ${w}px` }, onMouseDown: (e) => beginCellDrag(ri, ci, e), onMouseEnter: () => {
                                            if (dragRef.current?.kind === 'cell')
                                                applyCellDrag(ri, ci);
                                        }, onContextMenu: (e) => {
                                            e.preventDefault();
                                            // If this cell wasn't already in the selection,
                                            // promote it so the menu's "Copy" scope matches
                                            // the right-clicked cell — matches main-table
                                            // behaviour.
                                            if (!selected.has(cellKey(ri, ci))) {
                                                setSelected(new Set([cellKey(ri, ci)]));
                                                anchor.current = { r: ri, c: ci };
                                            }
                                            setMenu({ x: e.clientX, y: e.clientY, row: ri, col: ci });
                                        }, title: cell, children: _jsx("span", { className: "block truncate", children: cell || _jsx("span", { className: "text-surface-700", children: "\u2014" }) }) }, ci));
                                }), _jsx("div", { className: "flex-1" })] }, ri)))] }) })), menu && (_jsx(CellContextMenu, { x: menu.x, y: menu.y, selectionSize: selected.size, clickedValue: menuClickedCell, clickedIsUrl: menuClickedIsUrl, urlCountInSelection: collectUrlsFromSelection(selected, rows).length, onCopy: () => {
                    void copyCellsToClipboard(selected, rows);
                    setMenu(null);
                }, onCopyValue: () => {
                    void navigator.clipboard.writeText(menuClickedCell);
                    setMenu(null);
                }, onCopyUrls: () => {
                    const urls = collectUrlsFromSelection(selected, rows);
                    if (urls.length > 0) {
                        void writeTextToClipboard(urls.join('\n'));
                    }
                    setMenu(null);
                }, onOpen: () => {
                    void window.open(menuClickedCell, '_blank');
                    setMenu(null);
                }, onClose: () => setMenu(null) }))] }));
}
/**
 * In-page context menu for the Inlinks/Outlinks tables. Lives inside the
 * LinksView so it can read the same `selected` set without prop-drilling
 * an entire menu component.
 */
function CellContextMenu({ x, y, selectionSize, clickedValue, clickedIsUrl, urlCountInSelection, onCopy, onCopyValue, onCopyUrls, onOpen, onClose, }) {
    const items = [
        {
            label: selectionSize > 1
                ? `Copy ${selectionSize.toLocaleString()} Cells`
                : 'Copy Cell',
            action: onCopy,
            disabled: selectionSize === 0,
        },
    ];
    if (clickedIsUrl) {
        // When the right-clicked URL is part of a multi-cell selection
        // that spans multiple URL-looking cells, "Copy URL" copies ALL of
        // them (one per line). Single-cell selection collapses to the
        // legacy "copy this one URL" behaviour.
        if (urlCountInSelection > 1) {
            items.push({
                label: `Copy ${urlCountInSelection.toLocaleString()} URLs`,
                action: onCopyUrls,
            });
        }
        else {
            items.push({ label: 'Copy URL', action: onCopyValue });
        }
        items.push({ label: 'Open in Browser', action: onOpen });
    }
    else if (clickedValue) {
        items.push({ label: 'Copy Value', action: onCopyValue });
    }
    return (_jsx("div", { className: "fixed z-50 min-w-[180px] rounded border border-surface-700 bg-surface-900 py-1 text-[11px] shadow-lg", style: { left: x, top: y }, onMouseDown: (e) => e.stopPropagation(), onContextMenu: (e) => {
            e.preventDefault();
            onClose();
        }, children: items.map((it, i) => (_jsx("button", { type: "button", disabled: it.disabled, onClick: () => !it.disabled && it.action(), className: clsx('block w-full px-3 py-1 text-left', it.disabled
                ? 'cursor-not-allowed text-surface-600'
                : 'text-surface-200 hover:bg-accent-500/30 hover:text-surface-50'), children: it.label }, i))) }));
}
function isUrlLike(s) {
    return /^https?:\/\//i.test(s.trim());
}
/**
 * Pull every URL-looking cell value out of the current selection,
 * de-duplicate while preserving first-seen order (row → column), and
 * return them as an array. Used by the right-click "Copy N URLs"
 * action so a multi-cell selection in the From / To columns produces
 * one URL per line on the clipboard.
 */
function collectUrlsFromSelection(selected, rows) {
    if (selected.size === 0)
        return [];
    const keys = [...selected].sort((a, b) => {
        const [ra, ca] = a.split(':').map((n) => Number(n));
        const [rb, cb] = b.split(':').map((n) => Number(n));
        return (ra ?? 0) - (rb ?? 0) || (ca ?? 0) - (cb ?? 0);
    });
    const seen = new Set();
    const out = [];
    for (const k of keys) {
        const [rs, cs] = k.split(':');
        const r = Number(rs);
        const c = Number(cs);
        if (!Number.isFinite(r) || !Number.isFinite(c))
            continue;
        const value = rows[r]?.[c] ?? '';
        if (isUrlLike(value) && !seen.has(value)) {
            seen.add(value);
            out.push(value);
        }
    }
    return out;
}
/**
 * Write `text` to the OS clipboard with the same fallback chain as
 * `copyCellsToClipboard` — async API first, hidden textarea +
 * execCommand if the API is unavailable or permission-denied.
 */
async function writeTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    }
    catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
        }
        finally {
            document.body.removeChild(ta);
        }
    }
}
/**
 * Build a TSV string from the selected cells of a 2-D table and write it
 * to the OS clipboard. Cells are grouped by row (preserving the row
 * order shown in the UI) and within a row by ascending column index, so
 * paste-ing into a spreadsheet drops cells into matching grid positions.
 */
async function copyCellsToClipboard(selected, rows) {
    if (selected.size === 0)
        return;
    // Group selected cells by row index → list of column indexes.
    const byRow = new Map();
    for (const k of selected) {
        const [rs, cs] = k.split(':');
        const r = Number(rs);
        const c = Number(cs);
        if (!Number.isFinite(r) || !Number.isFinite(c))
            continue;
        const list = byRow.get(r);
        if (list)
            list.push(c);
        else
            byRow.set(r, [c]);
    }
    const sortedRows = [...byRow.keys()].sort((a, b) => a - b);
    const lines = [];
    for (const r of sortedRows) {
        const row = rows[r];
        if (!row)
            continue;
        const cols = (byRow.get(r) ?? []).sort((a, b) => a - b);
        lines.push(cols.map((c) => row[c] ?? '').join('\t'));
    }
    const text = lines.join('\n');
    try {
        await navigator.clipboard.writeText(text);
    }
    catch {
        // Clipboard API can fail (e.g. when window not focused); fall back
        // to a hidden textarea + execCommand which works in Electron even
        // when the clipboard permission is unset.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
        }
        finally {
            document.body.removeChild(ta);
        }
    }
}
function SerpSnippet({ row }) {
    const title = row.title ?? '(no title)';
    const desc = row.metaDescription ?? '(no meta description)';
    const titlePx = row.title ? measurePixelWidth(row.title, 15) : 0;
    const descPx = row.metaDescription ? measurePixelWidth(row.metaDescription, 13) : 0;
    const titleLimit = 600;
    const descLimit = 990;
    return (_jsxs("div", { className: "p-5", children: [_jsxs("div", { className: "max-w-[580px] rounded border border-surface-800 bg-surface-900 p-4", children: [_jsx("div", { className: "mb-1 truncate text-[12px] text-surface-400", children: displayUrl(row.url) }), _jsx("div", { className: "mb-1 text-[18px] leading-snug text-[#8ab4f8]", style: { maxWidth: 600 }, children: title.length > 100 ? title.slice(0, 100) + '…' : title }), _jsx("div", { className: "text-[13px] leading-snug text-surface-300", style: { maxWidth: 600 }, children: desc.length > 200 ? desc.slice(0, 200) + '…' : desc })] }), _jsxs("div", { className: "mt-4 grid grid-cols-2 gap-3 text-[11px]", children: [_jsx(InfoLine, { label: "Title pixel width", value: `${titlePx}px / ${titleLimit}px`, warn: titlePx > titleLimit }), _jsx(InfoLine, { label: "Title length", value: String(row.titleLength ?? 0) + ' chars' }), _jsx(InfoLine, { label: "Description pixel width", value: `${descPx}px / ${descLimit}px`, warn: descPx > descLimit }), _jsx(InfoLine, { label: "Description length", value: String(row.metaDescriptionLength ?? 0) + ' chars' })] })] }));
}
function InfoLine({ label, value, warn }) {
    return (_jsxs("div", { className: "flex items-center justify-between rounded border border-surface-800 bg-surface-900 px-3 py-2", children: [_jsx("span", { className: "text-surface-400", children: label }), _jsx("span", { className: clsx('font-mono', warn ? 'text-amber-400' : 'text-surface-100'), children: value })] }));
}
function displayUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname + (u.pathname === '/' ? '' : u.pathname);
    }
    catch {
        return url;
    }
}
// Crude pixel-width approximation using a canvas
let canvas = null;
function measurePixelWidth(text, fontPx) {
    if (!canvas) {
        canvas = document.createElement('canvas');
    }
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return 0;
    ctx.font = `${fontPx}px Arial, sans-serif`;
    return Math.round(ctx.measureText(text).width);
}
function httpStatusText(code) {
    if (code >= 200 && code < 300)
        return 'OK';
    if (code >= 300 && code < 400)
        return 'Redirect';
    if (code >= 400 && code < 500)
        return 'Client Error';
    if (code >= 500)
        return 'Server Error';
    return '';
}
/**
 * Render the JSON-stringified hreflang array as a single line of
 * `lang -> href` pairs, separated by ` · `. Returns null on empty/parse
 * failure so the row falls back to the "—" placeholder.
 */
/**
 * Expand the `custom_search_hits` JSON into one detail-panel row per
 * search term (`Custom: <term>` → `<count>`). Returns an empty array on
 * absent or malformed JSON so the surrounding row list isn't disturbed.
 */
/**
 * Expand the `extraction_results` JSON into one detail-panel row per
 * configured rule (`Extract: <name>` → `<value>`). Arrays are joined
 * with " | " for compact display; objects are pretty-stringified.
 * Empty array on absent / malformed JSON.
 */
function extractionRows(json) {
    if (!json)
        return [];
    try {
        const obj = JSON.parse(json);
        if (!obj || typeof obj !== 'object')
            return [];
        const out = [];
        for (const [name, raw] of Object.entries(obj)) {
            let display = null;
            if (raw === null || raw === undefined)
                display = null;
            else if (typeof raw === 'string')
                display = raw;
            else if (typeof raw === 'number')
                display = raw;
            else if (Array.isArray(raw))
                display = raw.map(String).join(' | ');
            else
                display = JSON.stringify(raw);
            out.push([`Extract: ${name}`, display]);
        }
        return out;
    }
    catch {
        return [];
    }
}
function customSearchRows(json) {
    if (!json)
        return [];
    try {
        const obj = JSON.parse(json);
        if (!obj || typeof obj !== 'object')
            return [];
        const out = [];
        for (const [term, raw] of Object.entries(obj)) {
            const count = typeof raw === 'number' ? raw : null;
            // null-render small zeros to keep the panel compact — users care
            // about hits, not absences.
            out.push([`Custom: "${term}"`, count && count > 0 ? count : null]);
        }
        return out;
    }
    catch {
        return [];
    }
}
function summarizeHreflangs(json) {
    if (!json)
        return null;
    try {
        const arr = JSON.parse(json);
        if (!Array.isArray(arr) || arr.length === 0)
            return null;
        return arr.map((h) => `${h.lang} → ${h.href}`).join(' · ');
    }
    catch {
        return null;
    }
}
function parseAnalyticsTrackers(json) {
    if (!json)
        return [];
    try {
        const arr = JSON.parse(json);
        if (!Array.isArray(arr))
            return [];
        return arr.filter((t) => t && typeof t.name === 'string' && t.name.length > 0);
    }
    catch {
        return [];
    }
}
function summarizeAnalyticsTrackers(json) {
    const list = parseAnalyticsTrackers(json);
    if (list.length === 0)
        return null;
    return list.map((t) => (t.id ? `${t.name} (${t.id})` : t.name)).join(' · ');
}
/**
 * Parse a single Set-Cookie header into its name + security attributes.
 * The cookie value itself is intentionally discarded — we only show what
 * matters for an SEO/security audit (name + flags + scope).
 */
function parseSetCookieHeader(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    const segments = trimmed.split(';').map((s) => s.trim());
    const first = segments[0] ?? '';
    const eq = first.indexOf('=');
    const name = eq >= 0 ? first.slice(0, eq).trim() : first;
    if (!name)
        return null;
    let domain = null;
    let path = null;
    let expires = null;
    let maxAge = null;
    let secure = false;
    let httpOnly = false;
    let sameSite = null;
    for (let i = 1; i < segments.length; i++) {
        const seg = segments[i] ?? '';
        if (!seg)
            continue;
        const lower = seg.toLowerCase();
        if (lower === 'secure')
            secure = true;
        else if (lower === 'httponly')
            httpOnly = true;
        else if (lower.startsWith('domain='))
            domain = seg.slice(7).trim() || null;
        else if (lower.startsWith('path='))
            path = seg.slice(5).trim() || null;
        else if (lower.startsWith('expires='))
            expires = seg.slice(8).trim() || null;
        else if (lower.startsWith('max-age='))
            maxAge = seg.slice(8).trim() || null;
        else if (lower.startsWith('samesite='))
            sameSite = seg.slice(9).trim() || null;
    }
    return { name, domain, path, expires, maxAge, secure, httpOnly, sameSite };
}
/**
 * Same comma-handling logic as `extractSetCookies` in the core package, but
 * client-side because the renderer can't import from `@freecrawl/core`
 * (Node-only).
 */
function splitJoinedSetCookie(joined) {
    const out = [];
    let buf = '';
    for (let i = 0; i < joined.length; i++) {
        const ch = joined[i];
        if (ch === ',') {
            let j = i + 1;
            while (j < joined.length && joined[j] === ' ')
                j++;
            const rest = joined.slice(j);
            if (/^[!#$%&'*+\-.^_`|~A-Za-z0-9]+\s*=/.test(rest)) {
                if (buf.trim())
                    out.push(buf.trim());
                buf = '';
                continue;
            }
        }
        buf += ch ?? '';
    }
    if (buf.trim())
        out.push(buf.trim());
    return out;
}
function CookiesView({ row, headers, }) {
    const cookies = [];
    for (const h of headers) {
        if (h.name.toLowerCase() !== 'set-cookie')
            continue;
        for (const raw of splitJoinedSetCookie(h.value)) {
            const parsed = parseSetCookieHeader(raw);
            if (parsed)
                cookies.push(parsed);
        }
    }
    if (cookies.length === 0) {
        return (_jsxs("div", { className: "p-4 text-[11px] text-surface-500", children: ["This page did not set any cookies (no ", _jsx("span", { className: "font-mono", children: "Set-Cookie" }), " response headers).", _jsx("div", { className: "mt-2 text-[10px] text-surface-600", children: "Note: only first-party cookies set by the page itself are listed here. Cookies set by third-party scripts (analytics, ads) are set in the browser at runtime and are not visible to a static crawler." })] }));
    }
    return (_jsxs("div", { className: "p-3", children: [_jsxs("div", { className: "mb-2 flex flex-wrap gap-3 text-[11px] text-surface-400", children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium text-surface-200", children: cookies.length }), " cookies set"] }), row.cookiesInsecure > 0 && (_jsxs("span", { className: "text-amber-400", children: [row.cookiesInsecure, " missing ", _jsx("code", { children: "Secure" })] })), row.cookiesNoHttpOnly > 0 && (_jsxs("span", { className: "text-amber-400", children: [row.cookiesNoHttpOnly, " missing ", _jsx("code", { children: "HttpOnly" })] })), row.cookiesNoSameSite > 0 && (_jsxs("span", { className: "text-amber-400", children: [row.cookiesNoSameSite, " missing ", _jsx("code", { children: "SameSite" })] }))] }), _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "sticky top-0 bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Name" }), _jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Domain" }), _jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Path" }), _jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Expires" }), _jsx("th", { className: "py-1 pr-3 text-center font-medium", children: "Secure" }), _jsx("th", { className: "py-1 pr-3 text-center font-medium", children: "HttpOnly" }), _jsx("th", { className: "py-1 text-left font-medium", children: "SameSite" })] }) }), _jsx("tbody", { children: cookies.map((c, idx) => (_jsxs("tr", { className: "border-b border-surface-900 last:border-0", children: [_jsx("td", { className: "py-1.5 pr-3 align-top font-mono text-surface-100", children: c.name }), _jsx("td", { className: "py-1.5 pr-3 align-top font-mono text-surface-300", children: c.domain ?? _jsx("span", { className: "text-surface-700", children: "\u2014" }) }), _jsx("td", { className: "py-1.5 pr-3 align-top font-mono text-surface-300", children: c.path ?? _jsx("span", { className: "text-surface-700", children: "/" }) }), _jsx("td", { className: "py-1.5 pr-3 align-top font-mono text-surface-400", children: c.expires ?? (c.maxAge ? `Max-Age ${c.maxAge}` : _jsx("span", { className: "text-surface-700", children: "session" })) }), _jsx("td", { className: "py-1.5 pr-3 text-center align-top", children: c.secure ? (_jsx("span", { className: "text-emerald-400", children: "\u2713" })) : (_jsx("span", { className: "text-amber-400", children: "\u2717" })) }), _jsx("td", { className: "py-1.5 pr-3 text-center align-top", children: c.httpOnly ? (_jsx("span", { className: "text-emerald-400", children: "\u2713" })) : (_jsx("span", { className: "text-amber-400", children: "\u2717" })) }), _jsx("td", { className: "py-1.5 align-top font-mono text-surface-300", children: c.sameSite ?? _jsx("span", { className: "text-amber-400", children: "missing" }) })] }, `${c.name}-${idx}`))) })] })] }));
}
/**
 * Pull every `<script type="application/ld+json">` block out of a raw HTML
 * body. Used by the Structured Data sub-tab to surface the actual payload
 * the page declares — supplements the per-URL `schema_types` summary with
 * the underlying JSON the parser saw.
 */
function extractJsonLdBlocks(html) {
    const blocks = [];
    const re = /<script\b[^>]*\btype\s*=\s*['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let i = 0;
    while ((match = re.exec(html)) !== null) {
        const raw = (match[1] ?? '').trim();
        if (!raw)
            continue;
        try {
            const parsed = JSON.parse(raw);
            blocks.push({ index: i, raw, parsed, ok: true });
        }
        catch {
            blocks.push({ index: i, raw, parsed: null, ok: false });
        }
        i++;
    }
    return blocks;
}
function StructuredDataView({ urlId, row, }) {
    const [src, setSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (urlId === null) {
            setSrc(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void window.freecrawl
            .urlSourceGet({ id: urlId })
            .then((r) => {
            if (!cancelled)
                setSrc(r);
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [urlId]);
    const types = (row.schemaTypes ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const blocks = src && src.body ? extractJsonLdBlocks(src.body) : [];
    const hasAnyData = types.length > 0 ||
        row.schemaBlockCount > 0 ||
        row.microdataCount > 0 ||
        row.rdfaCount > 0 ||
        blocks.length > 0;
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b border-surface-800 bg-surface-900/50 px-3 py-1.5 text-[11px] text-surface-400", children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium text-surface-200", children: row.schemaBlockCount }), " JSON-LD", row.schemaBlockCount === 1 ? ' block' : ' blocks'] }), row.schemaInvalidCount > 0 && (_jsxs("span", { className: "text-amber-400", children: [row.schemaInvalidCount, " invalid"] })), _jsxs("span", { children: [_jsx("span", { className: "font-medium text-surface-200", children: row.microdataCount }), " microdata items"] }), _jsxs("span", { children: [_jsx("span", { className: "font-medium text-surface-200", children: row.rdfaCount }), " RDFa attrs"] })] }), _jsxs("div", { className: "flex-1 overflow-auto p-3", children: [!hasAnyData && (_jsx("div", { className: "text-[11px] text-surface-500", children: "No structured data declared on this page (no JSON-LD, microdata or RDFa)." })), types.length > 0 && (_jsxs("div", { className: "mb-3", children: [_jsx("div", { className: "mb-1 text-[10px] uppercase tracking-wide text-surface-500", children: "Schema types" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: types.map((t) => (_jsx("span", { className: "rounded border border-surface-700 bg-surface-900 px-2 py-0.5 font-mono text-[11px] text-surface-200", children: t }, t))) })] })), loading && blocks.length === 0 && (_jsx("div", { className: "text-[11px] text-surface-500", children: "Loading source\u2026" })), blocks.length > 0 && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "text-[10px] uppercase tracking-wide text-surface-500", children: ["JSON-LD blocks (", blocks.length, ")"] }), blocks.map((b) => (_jsxs("div", { className: "rounded border border-surface-800 bg-surface-900/40", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-surface-800 px-2 py-1 text-[10px] text-surface-400", children: [_jsxs("span", { className: "font-mono", children: ["Block #", b.index + 1] }), b.ok ? (_jsx("span", { className: "text-emerald-400", children: "parsed OK" })) : (_jsx("span", { className: "text-amber-400", children: "parse failed" }))] }), _jsx("pre", { className: "overflow-auto p-2 font-mono text-[10.5px] leading-[14px] text-surface-200", children: b.ok
                                            ? JSON.stringify(b.parsed, null, 2)
                                            : b.raw })] }, b.index)))] })), !loading && blocks.length === 0 && row.schemaBlockCount > 0 && (_jsxs("div", { className: "mt-2 text-[10px] text-surface-600", children: ["JSON-LD blocks were detected during crawl but the page body snapshot is unavailable. Re-crawl with", ' ', _jsx("span", { className: "font-mono", children: "storeBodySnapshots" }), " enabled to view the raw payload."] }))] })] }));
}
function ImagesView({ urlId, row, }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (urlId === null) {
            setRows([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void window.freecrawl
            .urlPageImages({ id: urlId })
            .then((r) => {
            if (!cancelled)
                setRows(r.rows);
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [urlId]);
    if (loading && rows.length === 0) {
        return _jsx("div", { className: "p-4 text-[11px] text-surface-500", children: "Loading images\u2026" });
    }
    if (rows.length === 0) {
        return (_jsxs("div", { className: "p-4 text-[11px] text-surface-500", children: ["No ", _jsx("code", { children: "<img>" }), " tags discovered on this page."] }));
    }
    const missingAlt = rows.filter((r) => r.alt === null).length;
    const emptyAlt = rows.filter((r) => r.alt === '').length;
    const externalCount = rows.filter((r) => !r.isInternal).length;
    const LARGE_BYTES = 102_400;
    const largeCount = rows.filter((r) => r.byteSize !== null && r.byteSize > LARGE_BYTES).length;
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b border-surface-800 bg-surface-900/50 px-3 py-1.5 text-[11px] text-surface-400", children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium text-surface-200", children: rows.length }), " images"] }), missingAlt > 0 && (_jsxs("span", { className: "text-amber-400", children: [missingAlt, " missing alt"] })), emptyAlt > 0 && (_jsxs("span", { className: "text-surface-300", children: [emptyAlt, " empty alt (decorative)"] })), externalCount > 0 && (_jsxs("span", { children: [_jsx("span", { className: "font-medium text-surface-200", children: externalCount }), " external"] })), largeCount > 0 && (_jsxs("span", { className: "text-amber-400", children: [largeCount, " > 100\u00A0KB"] })), row.imagesCount > rows.length && (_jsxs("span", { className: "text-surface-500", children: ["(showing first ", rows.length, " of ", row.imagesCount, ")"] }))] }), _jsx("div", { className: "flex-1 overflow-auto p-3", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "sticky top-0 bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Source" }), _jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Alt" }), _jsx("th", { className: "py-1 pr-3 text-right font-medium", children: "W" }), _jsx("th", { className: "py-1 pr-3 text-right font-medium", children: "H" }), _jsx("th", { className: "py-1 pr-3 text-right font-medium", children: "Size" }), _jsx("th", { className: "py-1 text-left font-medium", children: "Scope" })] }) }), _jsx("tbody", { children: rows.map((r, i) => (_jsxs("tr", { className: "border-b border-surface-900 last:border-0", children: [_jsx("td", { className: "break-all py-1.5 pr-3 align-top font-mono text-surface-100", children: _jsx("a", { href: r.src, onClick: (e) => {
                                                e.preventDefault();
                                                void window.open(r.src, '_blank');
                                            }, className: "text-blue-300 hover:text-blue-200", children: r.src }) }), _jsx("td", { className: "py-1.5 pr-3 align-top text-surface-200", children: r.alt === null ? (_jsx("span", { className: "rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] uppercase text-amber-300", children: "missing" })) : r.alt === '' ? (_jsx("span", { className: "rounded bg-surface-800 px-1.5 py-0.5 text-[10px] uppercase text-surface-400", children: "empty" })) : (r.alt) }), _jsx("td", { className: "py-1.5 pr-3 text-right align-top font-mono text-surface-400", children: r.width ?? '—' }), _jsx("td", { className: "py-1.5 pr-3 text-right align-top font-mono text-surface-400", children: r.height ?? '—' }), _jsx("td", { className: clsx('py-1.5 pr-3 text-right align-top font-mono', r.byteSize !== null && r.byteSize > LARGE_BYTES
                                            ? 'text-amber-400'
                                            : 'text-surface-400'), children: r.byteSize === null ? '—' : formatBytesShort(r.byteSize) }), _jsx("td", { className: "py-1.5 align-top text-surface-300", children: r.isInternal ? 'internal' : 'external' })] }, `${r.src}-${i}`))) })] }) })] }));
}
function formatBytesShort(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
/**
 * Walk the body snapshot for `<script>`, `<link rel="stylesheet">`,
 * `<link rel="preload" as="font|style|script">`, and `<iframe>` references
 * — i.e. the resources the browser actually fetches when rendering the
 * page. Doesn't follow CSS @import chains; that would require fetching
 * each stylesheet which the View Source data alone can't do.
 */
function extractResources(html, pageUrl) {
    const out = [];
    let pageHost = '';
    try {
        pageHost = new URL(pageUrl).host;
    }
    catch {
        /* ignore */
    }
    function pushRef(type, rawUrl, attrs) {
        if (!rawUrl)
            return;
        if (rawUrl.startsWith('data:'))
            return;
        let resolved = rawUrl;
        let host = '';
        try {
            const u = new URL(rawUrl, pageUrl);
            resolved = u.href;
            host = u.host;
        }
        catch {
            return;
        }
        out.push({
            type,
            url: resolved,
            isExternal: host !== '' && pageHost !== '' && host !== pageHost,
            attrs,
        });
    }
    function attrMap(tag) {
        const m = {};
        const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
        let mm;
        while ((mm = re.exec(tag)) !== null) {
            const key = (mm[1] ?? '').toLowerCase();
            const value = mm[3] ?? mm[4] ?? mm[5] ?? '';
            m[key] = value;
        }
        return m;
    }
    const scriptRe = /<script\b([^>]*)>/gi;
    let match;
    while ((match = scriptRe.exec(html)) !== null) {
        const tag = match[0];
        const attrs = attrMap(tag);
        if (attrs['src']) {
            pushRef('script', attrs['src'], attrs);
        }
    }
    const linkRe = /<link\b([^>]*)>/gi;
    while ((match = linkRe.exec(html)) !== null) {
        const tag = match[0];
        const attrs = attrMap(tag);
        const rel = (attrs['rel'] ?? '').toLowerCase();
        const href = attrs['href'] ?? '';
        if (!href)
            continue;
        if (rel.includes('stylesheet')) {
            pushRef('stylesheet', href, attrs);
        }
        else if (rel.includes('preload')) {
            const as = (attrs['as'] ?? '').toLowerCase();
            if (as === 'font')
                pushRef('font', href, attrs);
            else if (as === 'style')
                pushRef('stylesheet', href, attrs);
            else if (as === 'script')
                pushRef('script', href, attrs);
            else if (as === 'image')
                pushRef('image', href, attrs);
            else
                pushRef('preload', href, attrs);
        }
    }
    const iframeRe = /<iframe\b([^>]*)>/gi;
    while ((match = iframeRe.exec(html)) !== null) {
        const tag = match[0];
        const attrs = attrMap(tag);
        if (attrs['src'])
            pushRef('iframe', attrs['src'], attrs);
    }
    return out;
}
function ResourcesView({ urlId, row, }) {
    const [src, setSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    useEffect(() => {
        if (urlId === null) {
            setSrc(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void window.freecrawl
            .urlSourceGet({ id: urlId })
            .then((r) => {
            if (!cancelled)
                setSrc(r);
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [urlId]);
    if (loading && !src) {
        return _jsx("div", { className: "p-4 text-[11px] text-surface-500", children: "Loading source\u2026" });
    }
    if (!src || src.body === null) {
        return (_jsxs("div", { className: "p-4 text-[11px] text-surface-500", children: ["Resources view requires a stored HTML body snapshot.", _jsxs("div", { className: "mt-1 text-[10px] text-surface-600", children: ["Re-crawl with the ", _jsx("span", { className: "font-mono", children: "storeBodySnapshots" }), " setting enabled."] })] }));
    }
    const resources = extractResources(src.body, row.url);
    const filtered = filter === 'all'
        ? resources
        : filter === 'external'
            ? resources.filter((r) => r.isExternal)
            : resources.filter((r) => r.type === filter);
    const counts = {
        all: resources.length,
        script: resources.filter((r) => r.type === 'script').length,
        stylesheet: resources.filter((r) => r.type === 'stylesheet').length,
        font: resources.filter((r) => r.type === 'font').length,
        iframe: resources.filter((r) => r.type === 'iframe').length,
        external: resources.filter((r) => r.isExternal).length,
    };
    const FILTERS = [
        { key: 'all', label: 'All', count: counts.all },
        { key: 'script', label: 'Scripts', count: counts.script },
        { key: 'stylesheet', label: 'Stylesheets', count: counts.stylesheet },
        { key: 'font', label: 'Fonts', count: counts.font },
        { key: 'iframe', label: 'Iframes', count: counts.iframe },
        { key: 'external', label: 'External (3rd-party)', count: counts.external },
    ];
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsx("div", { className: "flex flex-wrap items-center gap-1.5 border-b border-surface-800 bg-surface-900/50 px-3 py-1.5 text-[11px]", children: FILTERS.map((f) => (_jsxs("button", { onClick: () => setFilter(f.key), className: clsx('rounded border px-2 py-0.5 text-[10.5px]', filter === f.key
                        ? 'border-blue-600 bg-blue-900/40 text-blue-100'
                        : 'border-surface-700 text-surface-300 hover:bg-surface-800'), children: [f.label, " ", _jsxs("span", { className: "text-surface-500", children: ["(", f.count, ")"] })] }, f.key))) }), _jsx("div", { className: "flex-1 overflow-auto p-3", children: filtered.length === 0 ? (_jsx("div", { className: "text-[11px] text-surface-500", children: "No resources match this filter." })) : (_jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "sticky top-0 bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "w-24 py-1 pr-3 text-left font-medium", children: "Type" }), _jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "URL" }), _jsx("th", { className: "w-16 py-1 pr-3 text-center font-medium", children: "3rd-party" }), _jsx("th", { className: "py-1 text-left font-medium", children: "Hints" })] }) }), _jsx("tbody", { children: filtered.map((r, i) => {
                                const hints = [];
                                if (r.attrs['async'] !== undefined)
                                    hints.push('async');
                                if (r.attrs['defer'] !== undefined)
                                    hints.push('defer');
                                if ((r.attrs['type'] ?? '').toLowerCase() === 'module') {
                                    hints.push('module');
                                }
                                if (r.attrs['crossorigin']) {
                                    hints.push(`crossorigin=${r.attrs['crossorigin'] || 'anonymous'}`);
                                }
                                if (r.attrs['integrity'])
                                    hints.push('SRI');
                                if ((r.attrs['media'] ?? '').toLowerCase() === 'print') {
                                    hints.push('print-only');
                                }
                                return (_jsxs("tr", { className: "border-b border-surface-900 last:border-0", children: [_jsx("td", { className: "py-1.5 pr-3 align-top font-mono text-surface-300", children: r.type }), _jsx("td", { className: "break-all py-1.5 pr-3 align-top font-mono text-surface-100", children: _jsx("a", { href: r.url, onClick: (e) => {
                                                    e.preventDefault();
                                                    void window.open(r.url, '_blank');
                                                }, className: "text-blue-300 hover:text-blue-200", children: r.url }) }), _jsx("td", { className: "py-1.5 pr-3 text-center align-top", children: r.isExternal ? (_jsx("span", { className: "text-amber-400", children: "\u2713" })) : (_jsx("span", { className: "text-surface-700", children: "\u2014" })) }), _jsx("td", { className: "py-1.5 align-top font-mono text-[10px] text-surface-400", children: hints.join(' · ') })] }, `${r.url}-${i}`));
                            }) })] })) })] }));
}
/**
 * Multi-URL Images view — used when the user has 2+ rows selected in the
 * main table. Fetches `<img>` references for each page in parallel and
 * shows them in a single flat table with a leading Page column so the
 * source URL of each image is unambiguous.
 */
function MultiImagesView({ pages }) {
    const [byPage, setByPage] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const key = pages.map((p) => p.id).join(',');
    useEffect(() => {
        if (pages.length === 0) {
            setByPage(new Map());
            return;
        }
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            const results = await Promise.all(pages.map((p) => window.freecrawl
                .urlPageImages({ id: p.id })
                .then((r) => [p.id, r.rows])
                .catch(() => [p.id, []])));
            if (cancelled)
                return;
            setByPage(new Map(results));
            setLoading(false);
        };
        void load();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    if (loading && byPage.size === 0) {
        return _jsx("div", { className: "p-4 text-[11px] text-surface-500", children: "Loading images\u2026" });
    }
    let total = 0;
    let missingAlt = 0;
    let externalCount = 0;
    let largeCount = 0;
    const LARGE_BYTES = 102_400;
    for (const rows of byPage.values()) {
        total += rows.length;
        for (const r of rows) {
            if (r.alt === null)
                missingAlt++;
            if (!r.isInternal)
                externalCount++;
            if (r.byteSize !== null && r.byteSize > LARGE_BYTES)
                largeCount++;
        }
    }
    if (total === 0) {
        return (_jsxs("div", { className: "p-4 text-[11px] text-surface-500", children: ["No ", _jsx("code", { children: "<img>" }), " tags discovered across the ", pages.length, " selected pages."] }));
    }
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b border-surface-800 bg-surface-900/50 px-3 py-1.5 text-[11px] text-surface-400", children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium text-surface-200", children: total.toLocaleString() }), ' ', "images across ", _jsx("span", { className: "font-medium text-surface-200", children: pages.length }), ' ', "pages"] }), missingAlt > 0 && _jsxs("span", { className: "text-amber-400", children: [missingAlt, " missing alt"] }), externalCount > 0 && (_jsxs("span", { children: [_jsx("span", { className: "font-medium text-surface-200", children: externalCount }), " external"] })), largeCount > 0 && (_jsxs("span", { className: "text-amber-400", children: [largeCount, " > 100\u00A0KB"] }))] }), _jsx("div", { className: "flex-1 overflow-auto p-3", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "sticky top-0 bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Page" }), _jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Source" }), _jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Alt" }), _jsx("th", { className: "py-1 pr-3 text-right font-medium", children: "W" }), _jsx("th", { className: "py-1 pr-3 text-right font-medium", children: "H" }), _jsx("th", { className: "py-1 pr-3 text-right font-medium", children: "Size" }), _jsx("th", { className: "py-1 text-left font-medium", children: "Scope" })] }) }), _jsx("tbody", { children: pages.map((p) => {
                                const rows = byPage.get(p.id) ?? [];
                                return rows.map((r, i) => (_jsxs("tr", { className: "border-b border-surface-900 last:border-0", children: [_jsx("td", { className: "break-all py-1.5 pr-3 align-top font-mono text-[10px] text-surface-400", title: p.row.url, children: p.row.url }), _jsx("td", { className: "break-all py-1.5 pr-3 align-top font-mono text-surface-100", children: _jsx("a", { href: r.src, onClick: (e) => {
                                                    e.preventDefault();
                                                    void window.open(r.src, '_blank');
                                                }, className: "text-blue-300 hover:text-blue-200", children: r.src }) }), _jsx("td", { className: "py-1.5 pr-3 align-top text-surface-200", children: r.alt === null ? (_jsx("span", { className: "rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] uppercase text-amber-300", children: "missing" })) : r.alt === '' ? (_jsx("span", { className: "rounded bg-surface-800 px-1.5 py-0.5 text-[10px] uppercase text-surface-400", children: "empty" })) : (r.alt) }), _jsx("td", { className: "py-1.5 pr-3 text-right align-top font-mono text-surface-400", children: r.width ?? '—' }), _jsx("td", { className: "py-1.5 pr-3 text-right align-top font-mono text-surface-400", children: r.height ?? '—' }), _jsx("td", { className: clsx('py-1.5 pr-3 text-right align-top font-mono', r.byteSize !== null && r.byteSize > LARGE_BYTES
                                                ? 'text-amber-400'
                                                : 'text-surface-400'), children: r.byteSize === null ? '—' : formatBytesShort(r.byteSize) }), _jsx("td", { className: "py-1.5 align-top text-surface-300", children: r.isInternal ? 'internal' : 'external' })] }, `${p.id}-${r.src}-${i}`)));
                            }) })] }) })] }));
}
/**
 * Multi-URL Resources view — fetches each page's stored body snapshot in
 * parallel, runs the same `extractResources` parser per page, and merges
 * everything into one flat table with a leading Page column.
 */
function MultiResourcesView({ pages }) {
    const [byPage, setByPage] = useState(new Map());
    const [missingSnapshots, setMissingSnapshots] = useState(0);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    const key = pages.map((p) => p.id).join(',');
    useEffect(() => {
        if (pages.length === 0) {
            setByPage(new Map());
            return;
        }
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            const results = await Promise.all(pages.map((p) => window.freecrawl
                .urlSourceGet({ id: p.id })
                .then((r) => {
                if (!r || r.body === null)
                    return [p.id, null];
                return [p.id, extractResources(r.body, p.row.url)];
            })
                .catch(() => [p.id, null])));
            if (cancelled)
                return;
            const map = new Map();
            let missing = 0;
            for (const [id, entries] of results) {
                if (entries === null)
                    missing++;
                else
                    map.set(id, entries);
            }
            setByPage(map);
            setMissingSnapshots(missing);
            setLoading(false);
        };
        void load();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    if (loading && byPage.size === 0 && missingSnapshots === 0) {
        return _jsx("div", { className: "p-4 text-[11px] text-surface-500", children: "Loading resources\u2026" });
    }
    const allEntries = [];
    for (const p of pages) {
        const list = byPage.get(p.id);
        if (!list)
            continue;
        for (const entry of list)
            allEntries.push({ page: p, entry });
    }
    const filtered = filter === 'all'
        ? allEntries
        : filter === 'external'
            ? allEntries.filter((x) => x.entry.isExternal)
            : allEntries.filter((x) => x.entry.type === filter);
    const counts = {
        all: allEntries.length,
        script: allEntries.filter((x) => x.entry.type === 'script').length,
        stylesheet: allEntries.filter((x) => x.entry.type === 'stylesheet').length,
        font: allEntries.filter((x) => x.entry.type === 'font').length,
        iframe: allEntries.filter((x) => x.entry.type === 'iframe').length,
        external: allEntries.filter((x) => x.entry.isExternal).length,
    };
    const FILTERS = [
        { key: 'all', label: 'All', count: counts.all },
        { key: 'script', label: 'Scripts', count: counts.script },
        { key: 'stylesheet', label: 'Stylesheets', count: counts.stylesheet },
        { key: 'font', label: 'Fonts', count: counts.font },
        { key: 'iframe', label: 'Iframes', count: counts.iframe },
        { key: 'external', label: 'External (3rd-party)', count: counts.external },
    ];
    if (allEntries.length === 0 && missingSnapshots === pages.length) {
        return (_jsxs("div", { className: "p-4 text-[11px] text-surface-500", children: ["Resources view requires a stored HTML body snapshot for each page.", _jsxs("div", { className: "mt-1 text-[10px] text-surface-600", children: ["Re-crawl with the ", _jsx("span", { className: "font-mono", children: "storeBodySnapshots" }), " setting enabled."] })] }));
    }
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-1.5 border-b border-surface-800 bg-surface-900/50 px-3 py-1.5 text-[11px]", children: [FILTERS.map((f) => (_jsxs("button", { onClick: () => setFilter(f.key), className: clsx('rounded border px-2 py-0.5 text-[10.5px]', filter === f.key
                            ? 'border-blue-600 bg-blue-900/40 text-blue-100'
                            : 'border-surface-700 text-surface-300 hover:bg-surface-800'), children: [f.label, " ", _jsxs("span", { className: "text-surface-500", children: ["(", f.count, ")"] })] }, f.key))), missingSnapshots > 0 && (_jsxs("span", { className: "ml-2 text-[10px] text-amber-400", children: [missingSnapshots, " of ", pages.length, " pages have no stored body"] }))] }), _jsx("div", { className: "flex-1 overflow-auto p-3", children: filtered.length === 0 ? (_jsx("div", { className: "text-[11px] text-surface-500", children: "No resources match this filter." })) : (_jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "sticky top-0 bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "Page" }), _jsx("th", { className: "w-24 py-1 pr-3 text-left font-medium", children: "Type" }), _jsx("th", { className: "py-1 pr-3 text-left font-medium", children: "URL" }), _jsx("th", { className: "w-16 py-1 pr-3 text-center font-medium", children: "3rd-party" })] }) }), _jsx("tbody", { children: filtered.map(({ page, entry }, i) => (_jsxs("tr", { className: "border-b border-surface-900 last:border-0", children: [_jsx("td", { className: "break-all py-1.5 pr-3 align-top font-mono text-[10px] text-surface-400", title: page.row.url, children: page.row.url }), _jsx("td", { className: "py-1.5 pr-3 align-top font-mono text-surface-300", children: entry.type }), _jsx("td", { className: "break-all py-1.5 pr-3 align-top font-mono text-surface-100", children: _jsx("a", { href: entry.url, onClick: (e) => {
                                                e.preventDefault();
                                                void window.open(entry.url, '_blank');
                                            }, className: "text-blue-300 hover:text-blue-200", children: entry.url }) }), _jsx("td", { className: "py-1.5 pr-3 text-center align-top", children: entry.isExternal ? (_jsx("span", { className: "text-amber-400", children: "\u2713" })) : (_jsx("span", { className: "text-surface-700", children: "\u2014" })) })] }, `${page.id}-${entry.url}-${i}`))) })] })) })] }));
}
function ExtractedDataView({ row }) {
    const extraction = row.extractionResults
        ? safeJsonParse(row.extractionResults)
        : null;
    const search = row.customSearchHits ? safeJsonParse(row.customSearchHits) : null;
    const hasExtraction = extraction !== null &&
        typeof extraction === 'object' &&
        Object.keys(extraction).length > 0;
    const hasSearch = search !== null &&
        typeof search === 'object' &&
        Object.keys(search).length > 0;
    if (!hasExtraction && !hasSearch) {
        return (_jsxs("div", { className: "p-4 text-[11px] text-surface-500", children: ["No custom extraction rules or search terms have produced data for this page.", _jsxs("div", { className: "mt-2 text-[10px] text-surface-600", children: ["Configure rules in ", _jsx("span", { className: "font-mono", children: "Settings \u2192 Extraction" }), " or search terms in ", _jsx("span", { className: "font-mono", children: "Settings \u2192 Custom Search" }), ", then re-crawl."] })] }));
    }
    return (_jsxs("div", { className: "flex h-full flex-col gap-3 overflow-auto p-3", children: [hasExtraction && (_jsxs("section", { children: [_jsx("div", { className: "mb-2 text-[10px] uppercase tracking-wide text-surface-500", children: "Custom Extraction" }), _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "w-64 py-1 pr-3 text-left font-medium", children: "Rule" }), _jsx("th", { className: "py-1 text-left font-medium", children: "Value" })] }) }), _jsx("tbody", { children: Object.entries(extraction).map(([k, v]) => (_jsxs("tr", { className: "border-b border-surface-900 last:border-0", children: [_jsx("td", { className: "py-1.5 pr-3 align-top font-mono text-surface-300", children: k }), _jsx("td", { className: "break-all py-1.5 align-top font-mono text-surface-100", children: formatExtractedValue(v) })] }, k))) })] })] })), hasSearch && (_jsxs("section", { children: [_jsx("div", { className: "mb-2 text-[10px] uppercase tracking-wide text-surface-500", children: "Custom Search hits" }), _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "bg-surface-900", children: _jsxs("tr", { className: "text-surface-400", children: [_jsx("th", { className: "w-64 py-1 pr-3 text-left font-medium", children: "Term" }), _jsx("th", { className: "py-1 text-right font-medium", children: "Hits" })] }) }), _jsx("tbody", { children: Object.entries(search).map(([term, count]) => (_jsxs("tr", { className: "border-b border-surface-900 last:border-0", children: [_jsx("td", { className: "py-1.5 pr-3 align-top font-mono text-surface-100", children: term }), _jsx("td", { className: "py-1.5 text-right align-top font-mono text-surface-200", children: Number(count).toLocaleString() })] }, term))) })] })] }))] }));
}
function safeJsonParse(s) {
    try {
        return JSON.parse(s);
    }
    catch {
        return null;
    }
}
function formatExtractedValue(v) {
    if (v === null || v === undefined) {
        return _jsx("span", { className: "text-surface-700", children: "\u2014" });
    }
    if (Array.isArray(v)) {
        return (_jsx("pre", { className: "whitespace-pre-wrap break-all", children: JSON.stringify(v, null, 2) }));
    }
    if (typeof v === 'object') {
        return (_jsx("pre", { className: "whitespace-pre-wrap break-all", children: JSON.stringify(v, null, 2) }));
    }
    return String(v);
}
function parseHeadings(json) {
    if (!json)
        return [];
    try {
        const arr = JSON.parse(json);
        if (!Array.isArray(arr))
            return [];
        return arr.filter((h) => h &&
            typeof h.level === 'number' &&
            h.level >= 1 &&
            h.level <= 6 &&
            typeof h.text === 'string');
    }
    catch {
        return [];
    }
}
function OutlineView({ row }) {
    const outline = parseHeadings(row.headings);
    if (outline.length === 0) {
        return (_jsxs("div", { className: "p-4 text-[11px] text-surface-500", children: ["This page has no detected headings (no ", _jsx("code", { children: "<h1>" }), "\u2013", _jsx("code", { children: "<h6>" }), " elements). Pages without headings are harder for screen readers to navigate and may rank poorly for long-form queries."] }));
    }
    // Skip-detection: a heading skips a level when its level is more than
    // one greater than the previous heading's level (h1 → h3 etc.). The
    // very first heading isn't checked because the spec doesn't require
    // a strict h1 start (<main>-scoped outlines are valid).
    let prevLevel = null;
    const annotated = outline.map((h) => {
        const skipped = prevLevel !== null && h.level > prevLevel + 1
            ? `Skipped: previous was h${prevLevel}`
            : null;
        prevLevel = h.level;
        return { ...h, skipped };
    });
    const counts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    for (const h of outline)
        counts[`h${h.level}`] = (counts[`h${h.level}`] ?? 0) + 1;
    const skippedCount = annotated.filter((h) => h.skipped).length;
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b border-surface-800 bg-surface-900/50 px-3 py-1.5 text-[11px] text-surface-400", children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium text-surface-200", children: outline.length }), " headings"] }), ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((k) => counts[k] && counts[k] > 0 ? (_jsxs("span", { children: [_jsx("span", { className: "font-mono uppercase", children: k }), " \u00D7", counts[k]] }, k)) : null), skippedCount > 0 && (_jsxs("span", { className: "text-amber-400", children: [skippedCount, " skipped level", skippedCount === 1 ? '' : 's'] })), outline.length === 200 && (_jsx("span", { className: "text-surface-500", children: "(capped at 200)" }))] }), _jsx("div", { className: "flex-1 overflow-auto p-3", children: _jsx("ol", { className: "space-y-1 text-[11px]", children: annotated.map((h, i) => (_jsxs("li", { className: clsx('flex items-start gap-2 rounded border px-2 py-1', h.skipped
                            ? 'border-amber-700/40 bg-amber-900/15'
                            : 'border-surface-800 bg-surface-900/40'), style: { marginLeft: (h.level - 1) * 18 }, children: [_jsxs("span", { className: clsx('inline-flex h-5 min-w-[26px] items-center justify-center rounded font-mono text-[10px]', h.level === 1 && 'bg-blue-700/40 text-blue-100', h.level === 2 && 'bg-emerald-700/40 text-emerald-100', h.level === 3 && 'bg-cyan-700/40 text-cyan-100', h.level === 4 && 'bg-purple-700/40 text-purple-100', h.level === 5 && 'bg-pink-700/40 text-pink-100', h.level === 6 && 'bg-surface-700 text-surface-200'), children: ["H", h.level] }), _jsxs("span", { className: "flex-1 break-words text-surface-100", children: [h.text || (_jsx("span", { className: "italic text-surface-600", children: "(empty heading)" })), h.skipped && (_jsxs("span", { className: "ml-2 text-[10px] text-amber-400", children: ["\u26A0 ", h.skipped] }))] })] }, i))) }) })] }));
}
//# sourceMappingURL=BottomDetailPanel.js.map