'use client';

import { useEffect, useState } from 'react';
import { webApi } from '@/lib/api';

export default function Home() {
  const [summary, setSummary] = useState<any>(null);
  const [url, setUrl] = useState('https://example.com');
  const [crawling, setCrawling] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      const s = await webApi.summaryGet();
      setSummary(s);
    };
    fetchSummary();
    const timer = setInterval(fetchSummary, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleStart = async () => {
    setCrawling(true);
    await webApi.crawlStart({
      startUrl: url,
      maxDepth: 2,
      maxConcurrency: 5,
      maxRps: 2
    } as any);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            SEO Spider Web
          </h1>
          <p className="text-slate-400 mt-2">Advanced Website Spider & SEO Auditor — Web Edition</p>
        </header>

        <main className="grid gap-8">
          <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">Start New Crawl</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter URL to crawl..."
              />
              <button
                onClick={handleStart}
                disabled={crawling}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {crawling ? 'Crawling...' : 'Start Crawl'}
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
              <p className="text-slate-400 text-sm">Total URLs</p>
              <p className="text-3xl font-bold mt-1">{summary?.total || 0}</p>
            </div>
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
              <p className="text-slate-400 text-sm">Avg Response Time</p>
              <p className="text-3xl font-bold mt-1 text-emerald-400">{summary?.avgResponseTimeMs || 0}ms</p>
            </div>
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
              <p className="text-slate-400 text-sm">Status</p>
              <p className="text-3xl font-bold mt-1 text-blue-400">{crawling ? 'Active' : 'Idle'}</p>
            </div>
          </section>
          
          <div className="bg-amber-900/20 border border-amber-900/50 p-4 rounded-xl text-amber-200 text-sm">
            <strong>Note:</strong> On Vercel, long crawls may be interrupted due to serverless timeouts. For large sites, consider running the crawler on a persistent server like Railway.
          </div>
        </main>
      </div>
    </div>
  );
}
