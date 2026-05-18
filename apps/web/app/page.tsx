'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const API_BASE = '/api';

async function rpc(method: string, input?: unknown) {
  const res = await fetch(`${API_BASE}/rpc/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (!res.ok) return null;
  return res.json();
}

type Tab = 'overview' | 'urls' | 'issues' | 'export';

interface UrlRow {
  id: number;
  url: string;
  status_code: number | null;
  content_kind: string | null;
  depth: number;
  response_time_ms: number | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  indexability: string | null;
  crawled_at: string | null;
  size_bytes: number | null;
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  byContentKind: Record<string, number>;
  byIndexability: Record<string, number>;
  avgResponseTimeMs: number;
  totalBytes: number;
}

function statusColor(code: number | null): string {
  if (!code) return '#6b7280';
  if (code < 300) return '#22c55e';
  if (code < 400) return '#f59e0b';
  return '#ef4444';
}

function exportCSV(urls: UrlRow[]) {
  const headers = ['URL', 'Status', 'Title', 'Meta Description', 'H1', 'Content Type', 'Depth', 'Response (ms)', 'Indexability', 'Crawled At'];
  const rows = urls.map(u => [
    u.url, u.status_code ?? '', u.title ?? '', u.meta_description ?? '', u.h1 ?? '',
    u.content_kind ?? '', u.depth, u.response_time_ms ?? '', u.indexability ?? '', u.crawled_at ?? ''
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `seo-report-${Date.now()}.csv`;
  a.click();
}

function exportJSON(urls: UrlRow[]) {
  const blob = new Blob([JSON.stringify(urls, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `seo-report-${Date.now()}.json`;
  a.click();
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [urls, setUrls] = useState<UrlRow[]>([]);
  const [issues, setIssues] = useState<Record<string, number>>({});
  const [targetUrl, setTargetUrl] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortCol, setSortCol] = useState<string>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [logs, setLogs] = useState<string[]>(['[STBY] Waiting for crawl...']);
  const logsRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const [s, u, iss] = await Promise.all([
      rpc('getSummary'),
      rpc('getAllUrls'),
      rpc('getIssuesSummary'),
    ]);
    if (s) setSummary(s);
    if (Array.isArray(u)) setUrls(u);
    if (iss && typeof iss === 'object') setIssues(iss);
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 3000);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleStart = async () => {
    if (!targetUrl.trim()) { setError('URL REQUIRED'); return; }
    setError(null);
    setCrawling(true);
    addLog(`Starting crawl → ${targetUrl}`);
    try {
      const res = await fetch(`${API_BASE}/crawl/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUrl: targetUrl, maxDepth: 3, maxConcurrency: 5, maxRps: 2 }),
      });
      const data = await res.json();
      if (data?.error) {
        setError(data.error);
        addLog(`ERROR: ${data.error}`);
        setCrawling(false);
      } else {
        addLog('Crawler engine started. Fetching pages...');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      addLog(`ERROR: ${msg}`);
      setCrawling(false);
    }
  };

  const handleStop = async () => {
    setCrawling(false);
    addLog('Crawl stopped by user.');
  };

  // Filter + sort
  const filtered = urls
    .filter(u => filterStatus === 'all' || String(u.status_code ?? '').startsWith(filterStatus))
    .filter(u => !search || u.url.toLowerCase().includes(search.toLowerCase()) || (u.title ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = (a as any)[sortCol] ?? '';
      const bv = (b as any)[sortCol] ?? '';
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '9px', whiteSpace: 'nowrap', borderBottom: '1px solid #1f2937', cursor: 'pointer', userSelect: 'none', background: '#050505' };
  const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: '11px', borderBottom: '1px solid #0d0d0d', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  const sortTh = (col: string, label: string) => (
    <th style={thStyle} onClick={() => { setSortCol(col); setSortDir(sortCol === col && sortDir === 'asc' ? 'desc' : 'asc'); }}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#e5e7eb', fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace', display: 'flex', flexDirection: 'column' }}>

      {/* Top Bar */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#000', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontWeight: 900, fontSize: '16px', letterSpacing: '-0.04em', textTransform: 'uppercase' }}>
            SEO Spider <span style={{ color: '#374151' }}>v0.2.7</span>
          </span>
          <span style={{ fontSize: '9px', color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '3px 8px', letterSpacing: '0.1em', fontWeight: 700 }}>
            {crawling ? '● CRAWLING' : '● READY'}
          </span>
        </div>
        <div style={{ fontSize: '10px', color: '#374151' }}>
          {summary?.total ?? 0} URLs · {Object.values(issues).reduce((a,b) => a+b, 0)} Issues · avg {summary?.avgResponseTimeMs ?? 0}ms
        </div>
      </div>

      {/* URL Bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #111', display: 'flex', gap: '8px', background: '#000', flexShrink: 0 }}>
        <input
          type="text"
          value={targetUrl}
          onChange={e => setTargetUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !crawling && handleStart()}
          style={{ flex: 1, background: '#0a0a0a', color: '#fff', padding: '10px 16px', border: '1px solid #1f2937', outline: 'none', fontSize: '13px', fontFamily: 'inherit' }}
          placeholder="https://example.com  — Press Enter or click Start"
        />
        <button onClick={crawling ? handleStop : handleStart}
          style={{ background: crawling ? '#7f1d1d' : '#fff', color: crawling ? '#fca5a5' : '#000', padding: '10px 24px', border: 'none', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit' }}>
          {crawling ? '■ STOP' : '▶ START'}
        </button>
        <button onClick={fetchData}
          style={{ background: 'transparent', color: '#4b5563', padding: '10px 16px', border: '1px solid #1f2937', fontWeight: 700, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>
          ↻ REFRESH
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid #7f1d1d', padding: '10px 24px', color: '#f87171', fontSize: '11px', fontWeight: 700 }}>
          ✗ {error}
        </div>
      )}

      {/* Stats Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #111', background: '#000', flexShrink: 0 }}>
        {[
          { l: 'Total URLs', v: summary?.total ?? 0, c: '#fff' },
          { l: '2xx OK', v: summary?.byStatus?.['200'] ?? 0, c: '#22c55e' },
          { l: '3xx Redirect', v: Object.entries(summary?.byStatus ?? {}).filter(([k]) => k.startsWith('3')).reduce((s,[,v]) => s+v, 0), c: '#f59e0b' },
          { l: '4xx/5xx Error', v: Object.entries(summary?.byStatus ?? {}).filter(([k]) => Number(k) >= 400).reduce((s,[,v]) => s+v, 0), c: '#ef4444' },
          { l: 'Avg Response', v: `${summary?.avgResponseTimeMs ?? 0}ms`, c: (summary?.avgResponseTimeMs ?? 0) > 2000 ? '#ef4444' : (summary?.avgResponseTimeMs ?? 0) > 1000 ? '#f59e0b' : '#22c55e' },
          { l: 'Issues Found', v: Object.values(issues).reduce((a,b) => a+b, 0), c: '#f59e0b' },
          { l: 'Indexable', v: summary?.byIndexability?.['indexable'] ?? 0, c: '#22c55e' },
        ].map(s => (
          <div key={s.l} style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid #111' }}>
            <div style={{ fontSize: '8px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>{s.l}</div>
            <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '4px', color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #111', background: '#000', flexShrink: 0 }}>
        {(['overview', 'urls', 'issues', 'export'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '11px 20px', background: 'transparent', border: 'none',
            borderBottom: tab === t ? '2px solid #fff' : '2px solid transparent',
            color: tab === t ? '#fff' : '#4b5563', fontWeight: 700, fontSize: '10px',
            textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit'
          }}>
            {t === 'urls' ? `URLS (${urls.length})` : t === 'issues' ? `ISSUES (${Object.keys(issues).length})` : t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#111' }}>

            {/* Live Console */}
            <div style={{ background: '#050505', padding: '20px' }}>
              <div style={{ fontSize: '9px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '12px' }}>Live Console</div>
              <div ref={logsRef} style={{ height: '200px', overflowY: 'auto', fontSize: '10px', lineHeight: 1.6, color: '#4b5563' }}>
                {logs.map((l, i) => <div key={i} style={{ color: l.includes('ERROR') ? '#ef4444' : l.includes('start') ? '#22c55e' : '#4b5563' }}>{l}</div>)}
              </div>
            </div>

            {/* Status Breakdown */}
            <div style={{ background: '#050505', padding: '20px' }}>
              <div style={{ fontSize: '9px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '12px' }}>HTTP Status Distribution</div>
              {Object.keys(summary?.byStatus ?? {}).length === 0
                ? <div style={{ color: '#1f2937', fontSize: '12px' }}>No data — run a crawl first</div>
                : Object.entries(summary?.byStatus ?? {}).sort(([a],[b]) => Number(a)-Number(b)).map(([code, count]) => (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: statusColor(Number(code)), width: '40px' }}>{code}</span>
                    <div style={{ flex: 1, background: '#111', height: '6px', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: statusColor(Number(code)), width: `${Math.min(100, (count / (summary?.total || 1)) * 100)}%`, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: '#6b7280', width: '40px', textAlign: 'right' }}>{count}</span>
                  </div>
                ))
              }
            </div>

            {/* Content Type */}
            <div style={{ background: '#050505', padding: '20px' }}>
              <div style={{ fontSize: '9px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '12px' }}>Content Types</div>
              {Object.keys(summary?.byContentKind ?? {}).length === 0
                ? <div style={{ color: '#1f2937', fontSize: '12px' }}>No data</div>
                : Object.entries(summary?.byContentKind ?? {}).map(([kind, count]) => (
                  <div key={kind} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #0d0d0d' }}>
                    <span style={{ fontSize: '11px', color: '#a78bfa' }}>{kind || 'unknown'}</span>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>{count}</span>
                  </div>
                ))
              }
            </div>

            {/* Recent Crawls */}
            <div style={{ background: '#050505', padding: '20px' }}>
              <div style={{ fontSize: '9px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '12px' }}>Recently Crawled (Last 15)</div>
              {urls.length === 0
                ? <div style={{ color: '#1f2937', fontSize: '12px' }}>No URLs yet</div>
                : urls.slice(0, 15).map(u => (
                  <div key={u.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #0a0a0a' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: statusColor(u.status_code), width: '34px', flexShrink: 0 }}>{u.status_code ?? '—'}</span>
                    <span style={{ fontSize: '10px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{u.url}</span>
                    <span style={{ fontSize: '9px', color: '#374151', flexShrink: 0 }}>{u.response_time_ms ? `${u.response_time_ms}ms` : ''}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* URLS TAB */}
        {tab === 'urls' && (
          <div>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid #111', background: '#000', position: 'sticky', top: 0 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search URL or title..."
                style={{ flex: 1, background: '#0a0a0a', color: '#fff', padding: '7px 12px', border: '1px solid #1f2937', fontSize: '11px', fontFamily: 'inherit', outline: 'none' }}
              />
              {['all','2','3','4','5'].map(f => (
                <button key={f} onClick={() => setFilterStatus(f)}
                  style={{ padding: '7px 14px', background: filterStatus === f ? '#fff' : 'transparent', color: filterStatus === f ? '#000' : '#4b5563', border: '1px solid #1f2937', fontSize: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {f === 'all' ? 'ALL' : `${f}xx`}
                </button>
              ))}
              <span style={{ fontSize: '10px', color: '#4b5563', padding: '7px 0', whiteSpace: 'nowrap' }}>{filtered.length} results</span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {sortTh('status_code', 'Status')}
                  {sortTh('url', 'URL')}
                  {sortTh('title', 'Title')}
                  {sortTh('h1', 'H1')}
                  {sortTh('content_kind', 'Type')}
                  {sortTh('depth', 'Depth')}
                  {sortTh('response_time_ms', 'ms')}
                  {sortTh('indexability', 'Index')}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#1f2937', fontSize: '13px' }}>No URLs — start a crawl above ↑</td></tr>
                  : filtered.map(u => (
                    <tr key={u.id} style={{ background: 'transparent' }} onMouseEnter={e => (e.currentTarget.style.background = '#0a0a0a')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: statusColor(u.status_code) }}>{u.status_code ?? '—'}</td>
                      <td style={{ ...tdStyle, maxWidth: '320px' }}>
                        <a href={u.url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>{u.url}</a>
                      </td>
                      <td style={{ ...tdStyle, color: u.title ? '#9ca3af' : '#ef4444', maxWidth: '200px' }}>{u.title || '✗ Missing'}</td>
                      <td style={{ ...tdStyle, color: u.h1 ? '#9ca3af' : '#ef4444', maxWidth: '160px' }}>{u.h1 || '✗ Missing'}</td>
                      <td style={{ ...tdStyle, color: '#a78bfa' }}>{u.content_kind || '—'}</td>
                      <td style={{ ...tdStyle, color: '#6b7280' }}>{u.depth}</td>
                      <td style={{ ...tdStyle, color: (u.response_time_ms ?? 0) > 3000 ? '#ef4444' : (u.response_time_ms ?? 0) > 1000 ? '#f59e0b' : '#22c55e' }}>{u.response_time_ms ?? '—'}</td>
                      <td style={{ ...tdStyle, color: u.indexability === 'indexable' ? '#22c55e' : '#6b7280', fontSize: '10px' }}>{u.indexability || '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* ISSUES TAB */}
        {tab === 'issues' && (
          <div style={{ padding: '24px' }}>
            <div style={{ fontSize: '9px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '16px' }}>SEO Issues Found</div>
            {Object.keys(issues).length === 0
              ? <div style={{ color: '#374151', fontSize: '13px', padding: '48px', textAlign: 'center' }}>No issues detected — run a crawl first</div>
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {Object.entries(issues).sort(([,a],[,b]) => b-a).map(([issue, count]) => {
                    const sev = issue.includes('Error') || issue.includes('Missing') ? '#ef4444' : issue.includes('Slow') || issue.includes('Long') ? '#f59e0b' : '#a78bfa';
                    return (
                      <div key={issue} style={{ background: '#0a0a0a', border: `1px solid ${sev}22`, padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: sev }}>{issue}</div>
                          <div style={{ fontSize: '9px', color: '#4b5563', marginTop: '4px' }}>Affects {count} URL{count !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: sev }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        )}

        {/* EXPORT TAB */}
        {tab === 'export' && (
          <div style={{ padding: '32px', maxWidth: '600px' }}>
            <div style={{ fontSize: '9px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '24px' }}>Export Report Data</div>

            {urls.length === 0
              ? <div style={{ color: '#374151', fontSize: '13px', marginBottom: '24px' }}>⚠ No data yet — run a crawl first</div>
              : <div style={{ color: '#22c55e', fontSize: '11px', marginBottom: '24px' }}>✓ {urls.length} URLs ready for export</div>
            }

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Export as CSV', desc: 'All crawled URLs with status, title, meta, H1, depth, response time', action: () => exportCSV(urls), icon: '📊' },
                { label: 'Export as JSON', desc: 'Full raw data for all URLs including all SEO fields', action: () => exportJSON(urls), icon: '{}' },
              ].map(opt => (
                <button key={opt.label} onClick={opt.action} disabled={urls.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: '#0a0a0a', border: '1px solid #1f2937', cursor: urls.length === 0 ? 'not-allowed' : 'pointer', textAlign: 'left', fontFamily: 'inherit', opacity: urls.length === 0 ? 0.4 : 1 }}>
                  <span style={{ fontSize: '24px' }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>{opt.label}</div>
                    <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px' }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Issues summary in export */}
            {Object.keys(issues).length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <div style={{ fontSize: '9px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '12px' }}>Issues Summary</div>
                {Object.entries(issues).sort(([,a],[,b]) => b-a).map(([issue, count]) => (
                  <div key={issue} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #0d0d0d', fontSize: '12px' }}>
                    <span style={{ color: '#9ca3af' }}>{issue}</span>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
